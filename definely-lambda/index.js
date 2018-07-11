const AWS = require('aws-sdk');
const fs = require('fs');
const request = require('superagent');

const documentClient = new AWS.DynamoDB.DocumentClient();

const helper = require('./helper');

const OAUTH_TABLE = process.env.TABLE_NAME || 'definely-oauth-table';

const SUCCESS_HTML = fs.readFileSync('./success.html', 'utf8')

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const IS_QA = process.env.DEFINELY_QA;

const OAUTH_URL = IS_QA ?
"https://driftapiqa.com/oauth2/token" :
"https://driftapi.com/oauth2/token";

console.log('oauth url', OAUTH_URL);

/*
 * Attempts to send a message to the drift conversation view using the existing accessToken
 * - refreshing access token and retrying the send request on failure.
 */
const sendMessageWithRetry = (orgId, conversationId, driftMessage) => {
    const params = {
        TableName: OAUTH_TABLE,
        Key: {
            HashKey: orgId
        }
    };
    // Lookup the accesstoken for the current org.
    documentClient.get(params, function (err, data) {
        if (err) {
            // Entry for the orgId should exist in our table after the org installs the app, this is an invalid state.
            // user would need to reauth the app.
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            return;
        }
        const accessToken = data.accessToken;
        const refreshToken = data.refreshToken;

        helper.sendMessage(accessToken, conversationId, driftMessage, (err) => {
            return request.post(OAUTH_URL)
                .set('Content-Type', 'application/json')
                .send({
                    clientId: CLIENT_ID,
                    clientSecret: CLIENT_SECRET,
                    refreshToken: refreshToken,
                    grantType: 'refresh_token'
                })
                .then((res) => {
                    // New credentials post token refresh request.
                    const newRefreshToken = res.body.refreshToken;
                    const newAccessToken = res.body.accessToken;
                    const newParams = {
                        Item: {
                            "orgId": orgId,
                            "accessToken": newAccessToken,
                            "refreshToken": newRefreshToken
                        },
                        TableName: OAUTH_TABLE
                    };
                    // Update the token table.
                    documentClient.put(newParams, function (err, data) {
                        if (err) {
                            console.error('dynamo error', JSON.stringify(err));
                            // We may want to add better error handling here later in case our DB is at fault.
                            // This should be ok assumming normal DB function.
                        };
                        // Attempt to resend with new token.
                        helper.sendMessage(newAccessToken, conversationId, driftMessage, console.error);
                    });
                })
                .catch(err => console.error('error using refresh token', err));

        });
    });

}

/*
 * Message handler for items posted in the conversation view.
 */
const handleMessage = (orgId, data) => {
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
                sendMessageWithRetry(conversationId, driftMessage);
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
            const params = {
                Item: {
                    "orgId": orgId,
                    "accessToken": accessToken,
                    "refreshToken": refreshToken
                },
                TableName: OAUTH_TABLE
            }
            // Store the tokens for the org.
            console.log("storing token", JSON.stringify(params));
            documentClient.put(params, function(err, data) {
                // callback will supply the web response for the api.
                console.log('dynamo callback', err, data);
                if (err) {
                    console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    callback(err, helper.generateResponse(500, err));
                } else { // no error.
                    console.log('stored item');
                    callback(err, helper.generateResponse(200, SUCCESS_HTML));
                };
            });
        })
        .catch(err => console.log(err));
}

// Handler for all incoming requests.
exports.handler = (event, context, callback) => {
    const code = event.queryStringParameters.code
  return request.post(OAUTH_URL)
    .set('Content-Type', 'application/json')
    .send({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code,
      grantType: 'authorization_code'
    })
    .then((res) => {
      const { refreshToken, accessToken, orgId } = res.body
      const params = {
        Item: {
          orgId,
          accessToken,
          refreshToken
        },
        TableName: OAUTH_TABLE
      }
      documentClient.put(params, function (err, data) {
        if (err) {
          callback(err, generateResponse(err))
        } else {
          callback(err, generateResponse(SUCCESS_HTML)) 
        }
      })
    })
    .catch(err => console.log(err))

    // let code = "";
    // if (event.hasOwnProperty("queryStringParameters")) {
    //     code = event.queryStringParameters.code;
    //     console.log('received event code', JSON.stringify(code));
    // }
    
    // // If the authcode (redirect code) is defined, treat it as an authorization request.
    // if (code) {
    //     return handleAuth(code, callback);
    // } 

    // // Gandle as an api/webhook invocation.
    // const body = JSON.parse(event.body);
    // const orgId = body.orgId;
    // const data = body.data;
    // return handleMessage(orgId, data);
};

console.log('oauth table', OAUTH_TABLE);