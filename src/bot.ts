import axios from 'axios';
import WebSocket from 'ws';
import { Config } from './config';
import { Conversation, Extra, Message, User, WSInit, WSPing } from './types';
import { htmlToWhatsAppMarkdown, logger } from './utils';

export class Bot {
  user: User;
  websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
  }

  async init() {
    const whatsappBusinessAccount = await this.getWhatsAppBusinessAccount();
    this.user = {
      id: whatsappBusinessAccount.data.display_phone_number,
      firstName: whatsappBusinessAccount.data.verified_name,
      lastName: null,
      username: whatsappBusinessAccount.data.display_phone_number,
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

  convertMessage(change) {
    const extra: Extra = {
      originalMessage: change,
    };
    const conversation = new Conversation(change.contacts[0].wa_id, change.contacts[0].profile.name);
    const sender = new User(
      change.contacts[0].wa_id,
      change.contacts[0].profile.name,
      null,
      change.contacts[0].wa_id,
      false,
    );
    let content;
    let type;

    const msg = change.messages[0];
    const id: string = change.id;
    if (msg.type === 'text') {
      content = msg.text.body;
      type = 'text';
    } else if (msg.type === 'image') {
      content = msg.sticker.id;
      type = 'photo';
    } else if (msg.type === 'video') {
      content = msg.video.id;
      type = 'video';
    } else if (msg.type === 'audio') {
      content = msg.audio.id;
      type = msg.audio.voice ? 'voice' : 'audio';
    } else if (msg.type === 'document') {
      content = msg.document.id;
      type = 'document';
    } else if (msg.type === 'location') {
      content = msg.location;
      type = 'location';
    } else if (msg.type === 'sticker') {
      content = msg.image.id;
      type = 'sticker';
    } else {
      type = 'unsupported';
    }
    let reply: Message = null;

    const date = msg.timestamp;
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<any> {
    let caption = msg.extra?.caption;
    if (msg.extra && msg.extra.format && msg.extra.format === 'HTML') {
      caption = htmlToWhatsAppMarkdown(msg.extra?.caption);
    }
    caption = caption?.trim();

    let text = msg.content;
    if (msg.extra && msg.extra.format && msg.extra.format === 'HTML') {
      text = htmlToWhatsAppMarkdown(text);
    }
    text = text.trim();
    let payload = null;
    if (msg.type === 'text') {
      payload = {
        messaging_product: 'whatsapp',
        to: msg.conversation.id,
        type: 'text',
        text: { preview_url: msg.extra.preview, body: text },
      };
    } else if (msg.type === 'image') {
      payload = {
        messaging_product: 'whatsapp',
        to: msg.conversation.id,
        type: 'image',
        image: {
          link: msg.content,
          caption,
        },
      };
    } else if (msg.type === 'video') {
      payload = {
        messaging_product: 'whatsapp',
        to: msg.conversation.id,
        type: 'image',
        image: {
          link: msg.content,
          caption,
        },
      };
    } else if (msg.type === 'document') {
      payload = {
        messaging_product: 'whatsapp',
        to: msg.conversation.id,
        type: 'document',
        document: {
          link: msg.content,
        },
      };
    } else if (msg.type === 'audio' || msg.type === 'voice') {
      payload = {
        messaging_product: 'whatsapp',
        to: msg.conversation.id,
        type: 'audio',
        audio: {
          link: msg.content,
          voice: msg.type === 'voice',
        },
      };
    }

    return axios
      .post(`https://graph.facebook.com/${process.env.API_VERSION}/${process.env.PHONE_NUMBER_ID}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      .then(() => {})
      .catch((err) => {
        logger.error('Error sending message:', err.response.data);
      });
  }

  async getWhatsAppBusinessAccount(): Promise<any> {
    return axios.get(`https://graph.facebook.com/${process.env.API_VERSION}/${process.env.PHONE_NUMBER_ID}`, {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }
}
