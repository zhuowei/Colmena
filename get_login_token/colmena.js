import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js'
import {getAuth, GoogleAuthProvider, signInWithPopup} from 'https://www.gstatic.com/firebasejs/9.14.0/firebase-auth.js'

const firebaseConfigHive = {
  apiKey: 'AIzaSyB3jTpwkhqBGg6l6FkgQPecLxcgE3IWbcE',
  authDomain: 'hivecopy-508e2.firebaseapp.com',
  projectId: 'hivecopy-508e2',
  storageBucket: 'hivecopy-508e2.appspot.com',
  messagingSenderId: '930701983769',
  appId: '1:930701983769:android:14ee3785754df611c96a88',
};

const firebaseConfig = firebaseConfigHive;

const provider = new GoogleAuthProvider();
const app = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);

function indexedDBRequest(req) {
  return new Promise((success, fail) => {
    req.onsuccess = (event) => success(event);
    req.onerror = (event) => fail(event);
  });
}

async function colmenaLogin() {
  const authResult = await signInWithPopup(firebaseAuth, provider);
  console.log(authResult);
  await colmenaDumpAuth();
}

async function colmenaDumpAuth() {
  const indexdbresult =
      await indexedDBRequest(indexedDB.open('firebaseLocalStorageDb', 1));
  const db = indexdbresult.target.result;
  const transaction = db.transaction(['firebaseLocalStorage']);
  const objectStore = transaction.objectStore('firebaseLocalStorage');
  const response = await indexedDBRequest(objectStore.get(
      'firebase:authUser:AIzaSyB3jTpwkhqBGg6l6FkgQPecLxcgE3IWbcE:[DEFAULT]'));
  document.getElementById('output').textContent =
      JSON.stringify(response.target.result, null, 2);
}

window.colmena = {
  colmenaLogin,
  colmenaDumpAuth,
};
