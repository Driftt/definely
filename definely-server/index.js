const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent');

// Endpoint for drift conversation api, you'll want to leave DEFINELY_QA as undefined or false.
const CONVERSATION_API_BASE = process.env.DEFINELY_QA ?
    'https://driftapiqa.com/v1/conversations' :
    'https://driftapi.com/v1/conversations';

// Endpoint for word definition fetch.
const DEFINITION_URL = "https://www.twinword.com/api/v4/word/definition/"

const TOKEN = process.env.DEFINELY_TOKEN;
console.log('token', TOKEN);
console.log('conversation api', CONVERSATION_API_BASE);

// Send a drift message to be posted by the drift api.
const sendMessage = (conversationId, message) => {
    return request.post(CONVERSATION_API_BASE + `/${conversationId}/messages`)
        .set('Content-Type', 'application/json')
        .set(`Authorization`, `bearer ${TOKEN}`)
        .send(message)
        .catch(err => console.log('error', err.text))
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
    } else { // no definitions.
        body = `<br/><b>I got nothing for ${word}</b>, this is English correct?`;
    }
    body = body.replace(/(?:\r\n|\r|\n)/g, '<br/>');
    return `{
        "orgId": ${orgId},
        "body": "${body}",
        "type": "private_prompt"
      }`;
}

/*
 * Message handler for items posted in the conversation view.
 */
const handleMessage = (orgId, data) => {
    if (data.type === 'private_note') {
        const messageBody = data.body
        const conversationId = data.conversationId
        // Remove the command and search for the remaining text.
        if (messageBody.startsWith('/define')) {
            const wordToDefine = messageBody.replace('/define ', '')
            getDefinition(wordToDefine, data => {
                const body = JSON.parse(data.text);
                const meanings = body.meaning;
                const driftMessage = createDefinitionMessage(orgId, wordToDefine, meanings)
                sendMessage(conversationId, driftMessage);
            })
        }
    }
}

const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.listen(PORT, () => console.log(`Drift app listening on port ${PORT}!`))
app.post('/api', (req, res) => {
    // new_message is a particular drift event type for the web hook.
    if (req.body.type === 'new_message') {
        handleMessage(req.body.orgId, req.body.data)
    }
    return res.send('ok')
});
