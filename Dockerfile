FROM node:slim as builder

LABEL org.opencontainers.image.source https://github.com/ender-null/polaris-client-whatsapp

RUN npm install yarn@latest -g --force

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

ENV TZ=Europe/Madrid

EXPOSE 3000

CMD ["yarn", "start"]
