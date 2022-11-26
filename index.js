import {_getInstance} from '@firebase/auth/internal';
import escapeHtml from 'escape-html';
import express from 'express';
import {initializeApp} from 'firebase/app';
import {getAuth, inMemoryPersistence, onAuthStateChanged} from 'firebase/auth';
import {collection, doc, getDoc, getDocs, getFirestore, orderBy, query, where} from 'firebase/firestore';

import backendUser from './backend_user.json' assert {type : 'json'};
import {firebaseConfigHive} from './firebase_config_hive.js';

const app = express();

const port = process.env['PORT'] || 3000;
const staticPath = 'public';
const serverRoot = 'http://localhost:3000';

app.use(express.static(staticPath))
_getInstance(inMemoryPersistence)
    ._set(backendUser.fbase_key, backendUser.value);

const firebaseApp = initializeApp(firebaseConfigHive);
onAuthStateChanged(getAuth(firebaseApp), (user) => {
  console.log(user ? 'backend user worked' : 'backend user NOT WORKING!');
});
const db = getFirestore(firebaseApp);

function hiveTimestampToMastodonDate(hiveTimestamp) {
  return new Date(hiveTimestamp * 1000).toISOString();
}
const PLACEHOLDER_AVATAR = `${serverRoot}/avatars/original/missing.png`;
const PLACEHOLDER_HEADER = `${serverRoot}/headers/original/missing.png`;
function hiveUserToMastodonUser(hiveUser) {
  return {
    id: hiveUser._id,
    username: hiveUser.uname,
    acct: hiveUser.uname,
    display_name: hiveUser.fname,
    locked: false,
    bot: false,
    discoverable: true,
    group: false,
    created_at: hiveTimestampToMastodonDate(hiveUser.created),
    note: hiveUser.bio || '',
    url: `${serverRoot}/@${hiveUser.uname}`,
    avatar: hiveUser.avatar || PLACEHOLDER_AVATAR,
    avatar_static: hiveUser.avatar || PLACEHOLDER_AVATAR,
    header: hiveUser.banner || PLACEHOLDER_HEADER,
    header_static: hiveUser.banner || PLACEHOLDER_HEADER,
    followers_count: hiveUser.num_followers,
    following_count: hiveUser.num_following,
    statuses_count: hiveUser.num_posts,
    last_status_at: '2000-01-01',
    noindex: false,
    emojis: [],
    fields: [],
  };
}

function hivePostToMastodonStatus(hivePost, hiveUser) {
  return {
    id: hivePost._id,
    created_at: hiveTimestampToMastodonDate(hivePost.created),
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: hivePost.is_nsfw,
    spoiler_text: '',
    visibility: hivePost.is_private ? 'private' : 'public',
    language: 'en',
    uri: 'https://hivesocial.app/posts/' + hivePost._id,
    url: `${serverRoot}/@${hivePost.ouname}/${hivePost._id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    edited_at: null,
    content: escapeHtml(hivePost.desc),
    reblog: null,
    application: {name: 'Hive Social', website: 'https://hivesocial.app'},
    account: hiveUserToMastodonUser(hiveUser),
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
  };
}

app.get('/api/v1/accounts/lookup', async (req, res) => {
  const username = req.query.acct;
  const querySnapshot = await getDocs(
      query(collection(db, 'users'), where('uname', '==', username)));
  if (querySnapshot.docs.length != 1) {
    res.status(404).json({});
    return;
  }
  const data = {...querySnapshot.docs[0].data(), _id: querySnapshot.docs[0].id};
  res.status(200).json(hiveUserToMastodonUser(data));
});

app.get('/api/v1/accounts/:userId/statuses', async (req, res) => {
  if (req.query.pinned === 'true') {
    res.status(200).json([]);
    return;
  }
  const userId = req.params.userId;

  const userDoc = await getDoc(doc(db, 'users', userId));
  const hiveUser = {...userDoc.data(), _id: userId};

  const querySnapshot = await getDocs(query(
      collection(db, 'posts'), where('ouid', '==', userId),
      orderBy('__name__', 'desc')));
  res.status(200).json(querySnapshot.docs.map(
      doc => hivePostToMastodonStatus({...doc.data(), _id: doc.id}, hiveUser)));
});

const indexRoutes = ['/@:username', '/about'];

for (const indexRoute of indexRoutes) {
  app.get(indexRoute, (req, res) => {
    res.sendFile('index.html', {root: staticPath});
  });
}

app.listen(port, () => {console.log(`Example app listening on port ${port}`)})
