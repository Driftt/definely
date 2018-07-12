<p align="center">
  <img src="assets/definely.png"/>
  <p></p>
</p>

Definely - A Definition bot for drift conversations.
---

Definely is a <a href="www.drift.com" target="_blank">Drift</a> app written in Nodejs allowing agents to fetch definitions for words live within the drift conversation view.

### Getting Started

There are two different forms of the Definely app in this repository:
<ol>
    <li>Hosting the app with a self-managed server (without Oauth added).</li>
    <li>Hosting the app on AWS with Oauth (enabling public use).</li>
</ol>

### Deploying the server version.

This is the app described in the medium article 
<a href="https://medium.com/drift-engineering/your-first-drift-conversation-bot-63522aafcb8e" target="_blank">
    "Your first Drift Conversation Bot"
</a>.

This app as-is can be used internally for your org.


### Deploying the lambda version.

This is the app described in the medium article 
<a href="https://medium.com/drift-engineering/your-first-drift-conversation-bot-63522aafcb8e" target="_blank">
    Your first Drift Bot Application
</a>.

Compressing the app for lambda deployment.
<pre>
    zip -r lambda.zip definely-lambda/*
</pre>

<!-- This app is live and can be seen in the Drift App Store! -->


### Conversation View Screenshots

<img src="assets/conv1.png" width="600"/>

<img src="assets/conv2.png" width="600"/>

### Third party services:
* https://www.twinword.com/api/word-dictionary.php
