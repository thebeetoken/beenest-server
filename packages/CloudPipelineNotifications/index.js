const fetch = require('node-fetch');
const Codepipeline = require('./inputs/codepipeline');
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;


function sendMsg(text, succceed=true) {
  const url = DISCORD_WEBHOOK_URL + '/slack';
  const color = succceed ? "#04ff00" : "#ff0000";
  const title =  succceed ? 'SUCCESS' : 'ERROR';
  const body = {
        username: 'AWS',
        attachments: [{ color: color, fields: [{ title: title, value: text }]}],
        ts: new Date() / 1000
  };

  console.log(`POST ${url}`);
  return fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body)
  });
}

module.exports.sendCodepipelineMsg = (event, context, callback) => {
  if (!DISCORD_WEBHOOK_URL) {
    callback(new Error('No env defined'));
  }

  const text = Codepipeline.parse(event);
  const succeeded = text.includes('SUCCEEDED');
  return sendMsg(text, succeeded).then(res => {
      if (!res.ok) {
	    console.log(res);
        return callback(new Error('Not successful'), {statusCode: 500, body: res.body});
      }

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: `Sent to Discord at ${new Date()}`
        })
      };
      callback(null, response);
    })
    .catch(err => {
      return callback(err, {statusCode: 500, body: err.message});
    });
};

