/*
 * Helper library containing utility functions for the Definely app
 */
const library = (function () {
    const request = require('superagent');

    const TABLE_NAME = process.env.TABLE_NAME || 'definely-oauth-table';

    // Endpoint for word definition fetch.
    const DEFINITION_URL = "https://www.twinword.com/api/v4/word/definition/";

    /*
     * Retrieves a definition (if present) from twinword for the provided word
     * 
     * @param word the word to define
     * @param cb callback for a successful definition response
     */
    const getDefinition = (word, cb) => {
        // console.log(`Getting definition for: ${word}`)
        return request.post(DEFINITION_URL)
            .send(`entry=${word}`)
            .then(cb)
            .catch(console.error); // TODO: add proper error handling for definition fetch.
    }

    const capitalize = (s) => {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    const createTokenPayload = (orgId, accessToken, refreshToken) => {
        return {
            "Item": {
                "orgId": {
                    N: orgId + ""
                },
                "accessToken": {
                    S: accessToken
                },
                "refreshToken": {
                    S: refreshToken
                }
            },
            "TableName": TABLE_NAME
        };
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

    const generateResponse = (statusCode, body) => {
        return {
            "statusCode": statusCode,
            "headers": {
                "Content-Type": "text/html"
            },
            "body": body
        };
    }

    return {
        createTokenPayload: createTokenPayload,
        getDefinition: getDefinition,
        generateResponse: generateResponse,
        createDefinitionMessage: createDefinitionMessage,
    };

})();
module.exports = library;

