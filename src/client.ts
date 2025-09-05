import WebSocket from 'ws';
import { Bot } from './bot';
import { WSMessage } from './types';
import { catchException, logger } from './utils';
import express from 'express';
import bodyParser from 'body-parser';

let bot: Bot;
let ws: WebSocket;
let pingInterval;

const app = express();
app.use(bodyParser.json());

const close = () => {
  logger.warn(`Close server`);
  ws.terminate();
  process.exit();
};

process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
process.on('exit', () => {
  logger.warn(`Exit process`);
});

if (
  !process.env.SERVER ||
  !process.env.CONFIG ||
  !process.env.API_VERSION ||
  !process.env.ACCESS_TOKEN ||
  !process.env.VERIFY_TOKEN ||
  !process.env.PHONE_NUMBER_ID
) {
  if (!process.env.SERVER) {
    logger.warn(`Missing env variable SERVER`);
  }
  if (!process.env.CONFIG) {
    logger.warn(`Missing env variable CONFIG`);
  }
  if (!process.env.API_VERSION) {
    logger.warn(`Missing env variable API_VERSION`);
  }
  if (!process.env.ACCESS_TOKEN) {
    logger.warn(`Missing env variable ACCESS_TOKEN`);
  }
  if (!process.env.VERIFY_TOKEN) {
    logger.warn(`Missing env variable VERIFY_TOKEN`);
  }
  if (!process.env.PHONE_NUMBER_ID) {
    logger.warn(`Missing env variable PHONE_NUMBER_ID`);
  }
  close();
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    logger.info('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0]?.value;
  const messages = changes?.messages;
  if (messages && messages[0]) {
    entry?.changes.forEach((change) => {
      const msg = bot.convertMessage(change.value);
      const data: WSMessage = {
        bot: bot.user.username,
        platform: 'whatsapp',
        type: 'message',
        message: msg,
      };
      ws.send(JSON.stringify(data));
    });
  }

  res.sendStatus(200);
});

ws = new WebSocket(process.env.SERVER);
bot = new Bot(ws);

clearInterval(pingInterval);
pingInterval = setInterval(() => {
  bot.ping();
}, 30000);

ws.on('error', async (error: WebSocket.ErrorEvent) => {
  if (error['code'] === 'ECONNREFUSED') {
    logger.info(`Waiting for server to be available...`);
  } else {
    logger.error(error);
  }
});

ws.on('open', async () => {
  await bot.init();
});

ws.on('close', async (code) => {
  if (code === 1005) {
    logger.warn(`Disconnected`);
  } else if (code === 1006) {
    logger.warn(`Terminated`);
  }
  clearInterval(pingInterval);
  process.exit();
});

ws.on('message', (data: string) => {
  try {
    const msg = JSON.parse(data);
    if (msg.type !== 'pong') {
      //logger.info(JSON.stringify(msg, null, 4));
    }
    if (msg.type === 'message') {
      bot.sendMessage(msg.message);
    }
  } catch (error) {
    catchException(error);
  }
});

app.listen(3000, () => logger.info('Webhook listening on port 3000'));
