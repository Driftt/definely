const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient();

const helper = require('./helper');

const OAUTH_TABLE = process.env.TABLE_NAME || 'definely-oauth-table';
console.log('oauth table', OAUTH_TABLE);

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
            console.error('Error getting auth token from table', err);
            return;
        }
        const accessToken = data.accessToken;
        const refreshToken = data.refreshToken;

        sendMessage(accessToken, conversationId, driftMessage, (err) => {
            return helper.postRefreshToken(refreshToken)
                .then((res) => {
                    // New credentials post token refresh request.
                    const newRefreshToken = res.body.refreshToken;
                    const newAccessToken = res.body.accessToken;
                    const newParams = {
                        Item: {
                            orgId: orgId,
                            accessToken: newAccessToken,
                            refreshToken: newRefreshToken
                        },
                        TableName: OAUTH_TABLE
                    };
                    // Update the token table.
                    documentClient.put(newParams, function (err, data) {
                        if (err) {
                            console.error('error updating token table', err);
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

const handleAuth = (authCode, callback) => {
    return helper.postAuthCode(authCode)
        .then((res) => {
            const { refreshToken, accessToken, orgId } = res.body
            const params = {
                Item: {
                    orgId: orgId,
                    accessToken: accessToken,
                    refreshToken: refreshToken
                },
                TableName: OAUTH_TABLE
            }
            // Store the tokens for the org.
            documentClient.put(params, function (err, data) {
                // callback will supply the web response for the api.
                if (err) {
                    callback(err, helper.generateResponse(500, err));
                } else { // no error.
                    callback(null, helper.generateResponse(200, "<div>Registered App!</div>"));
                };
            });
        })
        .catch(err => console.log(err));
}

// Handler for all incoming requests.
exports.handler = (event, context, callback) => {
    const authCode = event.queryStringParameters.code;
    console.log('received event', JSON.stringify(event));
    
    // If the authcode (redirect code) is defined, treat it as an authorization request.
    if (authCode) {
        return handleAuth(authCode, callback);
    } else { // else handle as an api/webhook invocation.
        const body = JSON.parse(event.body);
        const orgId = body.orgId;
        const data = body.data;
        return handleMessage(orgId, data);
    }
};

