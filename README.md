Definely - A Drift word definer bot.
---

Definely is a drift app written in Nodejs for fetching definitions for words within the drift conversation view.

This is an app used both at Drift and in the medium article "Your first Drift Application".

### Setting up:

Define the following environment variable. You can get this from the 'Manage App' view of your app
<pre>
    DEFINELY_TOKEN={token}
</pre>

Then install the dependencies and start the app server.
<pre>
    yarn && yarn start
</pre>
The app should now be running on port 3001.

### Third party tools
* https://www.twinword.com/api/word-dictionary.php
