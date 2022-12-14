Unofficial web interface for [Hive Social](https://hivesocial.app) based on Mastodon's web interface.

![screenshot](https://notnow.dev/media/c6c1c6ed-1004-4eee-a85a-e90652666437/Fihb2laWYAAQPlP.jpeg)

You can view user profiles, posts, and hashtags. You cannot make posts or login.

## To run:

### Hosted instance

- View Hive Social user profile: https://hipster.house/@hive
- View Hive Social hashtag: https://hipster.house/tags/photography

### On a server, using shared credentials (read-only, no login):

Download colmenaproxy.zip from releases and extract it.

You will need to provide credentials for the server to log into Hive Social.

Firebase Authentication on Node.js only supports password auth, so for Login with Google, you need to login from your browser, then write the access token into backend_user.json:

- `cd get_login_token`
- `python3 -m http.server 8000`

Then navigate to http://localhost:8000 and click "Login with Google". Place the result in backend_user.json.

Then run

`node index.js`

The server will start on http://localhost:3000.

## Building

`npm install`

Copy the entire public/ folder of a Mastodon v4.0.2 installation into this directory

Copy mastodon_patches/ into public/

## Documentation

Hive Social is built entirely using [Firebase Firestore](https://firebase.google.com/docs/firestore), a serverless database designed to be queried directly from the client.

Login is handled with Firebase Authentication; however, access to the authentication APIs are restricted to "localhost", "hivecopy-508e2.firebaseapp.com", and "hivecopy-508e2.web.app".

## License

The Mastodon v4.0.2-derived code under public/ in the distribution zip is AGPL3.
