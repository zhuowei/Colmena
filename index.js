import {_getInstance} from '@firebase/auth/internal';
import escapeHtml from 'escape-html';
import express from 'express';
import {initializeApp} from 'firebase/app';
import {getAuth, inMemoryPersistence, onAuthStateChanged} from 'firebase/auth';
import {collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where} from 'firebase/firestore';

import backendUser from './backend_user.json' assert {type : 'json'};
import {firebaseConfigHive} from './firebase_config_hive.js';

const app = express();

const port = process.env['PORT'] || 3000;
const staticPath = 'public';
const serverRoot = process.env['SERVER_ROOT'] || `http://localhost:${port}`;

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
  const mediaAttachments = [];
  for (let i = 0; i < hivePost.media.length; i++) {
    mediaAttachments.push({
      preview_url: hivePost.thumb[i],
      type: 'image',
      url: hivePost.media[i],
    });
  }
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
    replies_count: hivePost.num_comments,
    reblogs_count: 0,
    favourites_count: hivePost.num_likes,
    edited_at: null,
    content: escapeHtml(hivePost.desc),
    reblog: null,
    application: {name: 'Hive Social', website: 'https://hivesocial.app'},
    account: hiveUserToMastodonUser(hiveUser),
    media_attachments: mediaAttachments,
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
  };
}

function handlePagination(req, ...filters) {
  const output = [...filters, limit((req.query.limit || 20) | 0)];
  if (req.query.min_id) {
    output.push(where('__name__', '>', req.query.min_id));
  }
  if (req.query.max_id) {
    output.push(where('__name__', '<', req.query.max_id));
  }
  return output;
}

function paginateLinkHeader(req, output) {
  if (output.length === 0) {
    return '';
  }
  const url = `${serverRoot}/${req.url}`;
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('max_id', output[output.length - 1].id);
  nextUrl.searchParams.delete('min_id');
  const prevUrl = new URL(url);
  prevUrl.searchParams.set('min_id', output[0].id);
  nextUrl.searchParams.delete('max_id');
  return `<${nextUrl}>; rel="next", <${prevUrl}>; rel="prev"`;
}

app.get('/api/v1/accounts/lookup', async (req, res) => {
  const username = req.query.acct.toLowerCase();
  const querySnapshot = await getDocs(
      query(collection(db, 'users'), where('uname', '==', username)));
  if (querySnapshot.docs.length != 1) {
    res.status(404).json({});
    return;
  }
  const data = {...querySnapshot.docs[0].data(), _id: querySnapshot.docs[0].id};
  res.status(200).json(hiveUserToMastodonUser(data));
});

app.get('/api/v1/accounts/:userId', async (req, res) => {
  const userId = req.params.userId;

  const userDoc = await getDoc(doc(db, 'users', userId));
  const hiveUser = {...userDoc.data(), _id: userId};
  res.status(200).json(hiveUserToMastodonUser(hiveUser));
});

app.get('/api/v1/accounts/:userId/statuses', async (req, res) => {
  if (req.query.pinned === 'true') {
    res.status(200).json([]);
    return;
  }
  const userId = req.params.userId;

  const userDoc = await getDoc(doc(db, 'users', userId));
  const hiveUser = {...userDoc.data(), _id: userId};

  const querySnapshot = await getDocs(query(...handlePagination(
      req, collection(db, 'posts'), where('ouid', '==', userId),
      orderBy('__name__', 'desc'))));
  const output = querySnapshot.docs.map(
      doc => hivePostToMastodonStatus({...doc.data(), _id: doc.id}, hiveUser));
  res.status(200).header('link', paginateLinkHeader(req, output)).json(output);
});

app.get('/api/v1/statuses/:statusId', async (req, res) => {
  const statusId = req.params.statusId;

  const postDoc = await getDoc(doc(db, 'posts', statusId));
  const hivePost = {...postDoc.data(), _id: statusId};
  const userDoc = await getDoc(doc(db, 'users', hivePost.ouid));
  const hiveUser = {...userDoc.data(), _id: hivePost.ouid};
  res.status(200).json(hivePostToMastodonStatus(hivePost, hiveUser));
});

app.get('/api/v1/statuses/:statusId/context', async (req, res) => {
  // TODO(zhuowei): can't figure this one out.
  // I'll probably translate questions as embeds not threads; still can't find
  // an actual thread
  res.status(200).json({ancestors: [], descendants: []});
});

const indexRoutes = ['/@:username', '/@:username/:status', '/about'];

for (const indexRoute of indexRoutes) {
  app.get(indexRoute, (req, res) => {
    res.sendFile('index.html', {root: staticPath});
  });
}

app.listen(port, () => {console.log(`Example app listening on port ${port}`)})
