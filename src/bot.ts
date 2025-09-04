import WebSocket from 'ws';
import { Conversation, Extra, Message, User, WSInit, WSPing } from './types';
import { Config } from './config';
import { logger } from './utils';
import axios from 'axios';

export class Bot {
  user: User;
  websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
  }

  async init() {
    const whatsappBusinessAccount = await this.getWhatsAppBusinessAccount();
    const phoneNumbers: any = await axios.get(
      `https://graph.facebook.com/${process.env.API_VERSION}/${whatsappBusinessAccount.whatsapp_business_account.id}/phone_numbers`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    this.user = {
      id: phoneNumbers.data[0].id,
      firstName: phoneNumbers.data[0].verified_name,
      lastName: null,
      username: phoneNumbers.data[0].id,
      isBot: true,
    };
    const config: Config = JSON.parse(process.env.CONFIG);
    const data: WSInit = {
      bot: this.user.username,
      platform: 'whatsapp',
      type: 'init',
      user: this.user,
      config,
    };

    this.websocket.send(JSON.stringify(data, null, 4));
    logger.info(`Connected as @${data.user.username}`);
  }

  ping() {
    logger.debug('ping');
    if (this.user) {
      const data: WSPing = {
        bot: this.user.username,
        platform: 'whatsapp',
        type: 'ping',
      };
      this.websocket.send(JSON.stringify(data, null, 4));
    }
  }

  convertMessage(msg) {
    const id: string = msg.id;
    const extra: Extra = {
      originalMessage: msg,
    };

    const conversation = new Conversation(msg.from, msg.from);
    const sender = new User(msg.from, msg.from, null, msg.from, false);
    let content;
    let type;

    if (msg.type === 'text') {
      content = msg.text.body;
      type = 'text';
    } else {
      type = 'unsupported';
    }
    let reply: Message = null;

    const date = msg.timestamp;
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<any> {
    return axios
      .post(
        `https://graph.facebook.com/${process.env.API_VERSION}/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: msg.conversation.id,
          text: { body: msg.content },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      )
      .then(() => {})
      .catch((err) => {
        logger.error('Error sending message:', err.response.data);
      });
  }

  async getWhatsAppBusinessAccount(): Promise<any> {
    return axios.get(
      `https://graph.facebook.com/${process.env.API_VERSION}/${process.env.PHONE_NUMBER_ID}?fields=whatsapp_business_account`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
