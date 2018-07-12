const AWS = require('aws-sdk');
const fs = require('fs');
const request = require('superagent');

const ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});

const helper = require('./helper');

const TABLE_NAME = process.env.TABLE_NAME || 'definely-oauth-table';

const SUCCESS_HTML = fs.readFileSync('./success.html', 'utf8')

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const IS_QA = process.env.DEFINELY_QA;

const OAUTH_URL = IS_QA ?
    "https://driftapiqa.com/oauth2/token" :
    "https://driftapi.com/oauth2/token";

// Endpoint for drift conversation api, you'll want to leave DEFINELY_QA as undefined or false.
const CONVERSATION_API_BASE = IS_QA ?
    'https://driftapiqa.com/v1/conversations' :
    'https://driftapi.com/v1/conversations';

console.log('oauth url', OAUTH_URL);
console.log('oauth table', TABLE_NAME);

/*
 * Attempts to refresh the access token and retry the send request.
 */
const refetchTokenAndResend = (refreshToken, conversationId, message) => {
    return request.post(OAUTH_URL)
      .set('Content-Type', 'application/json')
      .send({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken,
        grantType: 'refresh_token'
      })
      .then((res) => {
        const { orgId } = res.body
        const newAccessToken = res.body.accessToken
        const newRefreshToken = res.body.refreshToken
        const params = helper.createTokenPayload(orgId, newAccessToken, newRefreshToken);
        return ddb.putItem(params, function (err, data) {
          if (!err) {
            return sendMessage(orgId, conversationId, message) 
          }
        })
      })
      .catch(err => console.log(err))
}

const sendMessage = (orgId, conversationId, message) => {
    const params = {
        TableName: TABLE_NAME,
        Key: { 'orgId': { N: orgId.toString() } }
    }
    return ddb.getItem(params, (err, data) => {
        if (!err && data) { // if we successfully 
            console.log("fetch auth tokens", orgId, data, err);
            const accessToken = data.Item.accessToken.S
            const refreshToken = data.Item.refreshToken.S
            return request.post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
                .set('Content-Type', 'application/json')
                .set(`Authorization`, `bearer ${accessToken}`)
                .send(message)
                .catch(err => {
                console.error("Error sending message, attempting retry", err.response.body);
                if (err.response.body.error.type === 'authentication_error') {
                    return refetchTokenAndResend(refreshToken, conversationId, message)
                }
            })  
        } else {
            console.error("Could not find token for orgId " + orgId, err, data, " - will need reauth");
        }
    })
}

/*
 * Message handler for items posted in the conversation view.
 */
const handleMessage = (orgId, data) => {
    console.log('handle message', orgId, data);
    if (data.type === 'private_note') {
        const messageBody = data.body;
        const conversationId = data.conversationId;
        // Remove the command and search for the remaining text.
        if (messageBody.startsWith('/define')) {
            const wordToDefine = messageBody.replace('/define ', '')
            helper.getDefinition(wordToDefine, data => {
                const body = JSON.parse(data.text);
                const meanings = body.meaning;
                const driftMessage = helper.createDefinitionMessage(orgId, wordToDefine, meanings);
                sendMessage(orgId, conversationId, driftMessage);
            });
        }
    }
}

const handleAuth = (code, callback) => {
    return request.post(OAUTH_URL)
        .set('Content-Type', 'application/json')
        .send({
            "clientId": CLIENT_ID,
            "clientSecret": CLIENT_SECRET,
            "code": code,
            "grantType": "authorization_code"
        })
        .then((res) => {
            const { refreshToken, accessToken, orgId } = res.body;
            const params = helper.createTokenPayload(orgId, accessToken, refreshToken);
            // Store the tokens for the org.
            console.log("storing token", JSON.stringify(params));
            ddb.putItem(params, function(err, data) {
                // callback will supply the web response for the api.
                if (err) {
                    console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    callback(err, helper.generateResponse(500, err));
                } else { // no error.
                    console.log('stored item', data);
                    callback(err, helper.generateResponse(200, SUCCESS_HTML));
                };
            });
        })
        .catch(err => console.log(err));
    }

const generateResponse = (body) => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type" : "text/html"
    },
    body
  }
}

exports.handler = (event, context, callback) => {
    let code = "";
    if (event.queryStringParameters) {
        code = event.queryStringParameters.code;
        console.log('received event code', JSON.stringify(code));
    }
    
    // If the authcode (redirect code) is defined, treat it as an authorization request.
    if (code) {
        return handleAuth(code, callback);
    } 

    // Gandle as an api/webhook invocation.
    const body = JSON.parse(event.body);
    const orgId = body.orgId;
    const data = body.data;
    return handleMessage(orgId, data);
};