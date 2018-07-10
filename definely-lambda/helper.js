/*
 * Helper library containing utility functions for the Definely app
 */
const library = (function () {
    const request = require('superagent');

    const IS_QA = process.env.DEFINELY_QA;
    // Endpoint for drift conversation api, you'll want to leave DEFINELY_QA as undefined or false.
    const CONVERSATION_API_BASE = IS_QA ?
        'https://driftapiqa.com/v1/conversations' :
        'https://driftapi.com/v1/conversations';

    const OAUTH_URL = IS_QA ?
        "https://driftapiqa.com/oauth2/token" :
        "https://driftapi.com/oauth2/token";

    // Endpoint for word definition fetch.
    const DEFINITION_URL = "https://www.twinword.com/api/v4/word/definition/";

    console.log('oauth url', OAUTH_URL);
    console.log('conversation api', CONVERSATION_API_BASE);

    // Send a drift message to be posted by the drift api.
    const sendMessage = (token, conversationId, message, onFail) => {
        return request.post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
            .set('Content-Type', 'application/json')
            .set(`Authorization`, `bearer ${token}`)
            .send(message)
            .catch(onFail);
    }

    /*
     * Retrieves a definition (if present) from twinword for the provided word
     * 
     * @param word the word to define
     * @param cb callback for a successful definition response
     */
    const getDefinition = (word, cb) => {
        console.log(`Getting definition for: ${word}`)
        return request.post(DEFINITION_URL)
            .send(`entry=${word}`)
            .then(cb)
            .catch(console.error); // TODO: add proper error handling for definition fetch.
    }

    const capitalize = (s) => {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /*
     * Creates a drift formatted message based on the provided word meanings.
     * See: https://devdocs.drift.com/docs/creating-a-message
     *
     * @param meanings {"noun": <string>, "verb": <string>, "adverb": <string>, "adjective": <string>}
     * @return drift formatted message for conversation api.
     */
    const createDefinitionMessage = (orgId, word, meanings) => {
        if (!meanings) {
            // No meanings found.
            meanings = {};
        }
        const useTypes = Object.keys(meanings);
        const header = `<h3>Definely: <b>${word}</b></h3>`;
        let body = header;
        let defs = "";
        useTypes.map(useType => {
            const meaning = meanings[useType];
            if (meaning) {
                defs += `<b>${capitalize(useType)}</b>:<br/>${meaning}<br/>`;
            }
        });
        if (defs.length) {
            body += defs;
        } else {
            body = `<br/><b>I got nothing for ${word}</b>, this is English correct?`;
        }
        body = body.replace(/(?:\r\n|\r|\n)/g, '<br/>');
        return `{
        "orgId": ${orgId},
        "body": "${body}",
        "type": "private_prompt"
      }`;
    }

    const postRefreshToken = (refreshToken) => {
        return request.post(OAUTH_URL)
            .set('Content-Type', 'application/json')
            .send({
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: refreshToken,
                grantType: 'refresh_token'
            })
    }

    const postAuthCode = (authCode) => {
        return request.post(OAUTH_URL)
            .set('Content-Type', 'application/json')
            .send({
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                code: authCode,
                grantType: 'authorization_code'
            })
    }

    const generateResponse = (status, body) => {
        return {
            statusCode: status,
            body: body,
            headers: {
                "Content-Type": "text/html"
            }
        };
    }

    return {
        sendMessage: sendMessage,
        getDefinition: getDefinition,
        generateResponse: generateResponse,
        createDefinitionMessage: createDefinitionMessage,
        postAuthCode: postAuthCode,
        postRefreshToken: postRefreshToken
    };

})();
module.exports = library;
