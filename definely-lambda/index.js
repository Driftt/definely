const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient();
const request = require('superagent');
const fs = require('fs')

const SUCCESS_HTML = fs.readFileSync('./success.html', 'utf8')
const TABLE_NAME = process.env.TABLE_NAME || 'definely-oauth-table';

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
  const code = event.queryStringParameters.code
  return request.post(process.env.OAUTH_URL)
    .set('Content-Type', 'application/json')
    .send({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
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
        TableName: TABLE_NAME
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
};
