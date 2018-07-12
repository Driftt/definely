definely-server
---

Example Server-based <a href="www.drift.com" target="_blank">Drift</a> app.

### Getting Started

Define the following environment variable. You can get this value from the 'Manage App' view of your app after you have installed the application to your drift org.

<pre>
    DEFINELY_TOKEN={token}
</pre>
Note that in a public app this token will be retrieved/managed via Oauth.

Lastly, install the dependencies and start the app server.
<pre>
    yarn && yarn start
</pre>
The app should now be running on port 3001.
