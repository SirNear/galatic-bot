const Client = require('./GalaticClient')
const GatewayIntentBits = require('discord.js')
const config = require('./config')
const client = new Client({
   intents: ["MessageContent"],
   disableMentions: "everyone",
})
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const VERIFY_TOKEN = "8392b740301147aa366dde933daaab9d";
const PAGE_ACCESS_TOKEN = "EAAMfAcCY4qQBADgniec6IVNh5eBjkm4MhyS82o2tTgxhLyEvJngtrssMZCMuE1nZCZBHZBf1rhKDqXLWZCIpp8c6YMZCAO1BDUfijZBZC2ZAtG8XCzIWN4IZB6czstn5ZANHjcml4YTofwjacptWydUgvaYLSARfB3hf3jZAWVcwwZAvxe2wZByeAiOlIb";

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Acesso negado.');
  }
});

app.post('/webhook', (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
       
       if (webhook_event.message) {
        let sender_psid = webhook_event.sender.id;
        sendTextMessage(sender_psid, "Testando vc bro");
      }
    });//body.entry
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.status(404).send();
  }//else
   
});//app.post

app.listen(3000, () => {
  console.log('Servidor iniciado na porta 3000');
});






client.loadCommands('./commands')
client.loadEvents('./events')
client.login(config.token)
.then(() => console.log("Acordei"))
.catch((err) => console.log(`Erro ao iniciar: ${err.message}`));
