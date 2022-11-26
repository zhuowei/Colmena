import {_getInstance} from '@firebase/auth/internal';
import express from 'express';
import {initializeApp} from 'firebase/app';
import {getAuth, inMemoryPersistence, onAuthStateChanged} from 'firebase/auth';
import {collection, doc, getDoc, getDocs, getFirestore, query, where} from 'firebase/firestore';

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

app.get('/api/v1/accounts/:userid/statuses', async (req, res) => {
  res.status(200).json([]);
});

const indexRoutes = ['/@:username', '/about'];

for (const indexRoute of indexRoutes) {
  app.get(indexRoute, (req, res) => {
    res.sendFile('index.html', {root: staticPath});
  });
}

app.listen(port, () => {console.log(`Example app listening on port ${port}`)})
