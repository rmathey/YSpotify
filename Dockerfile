FROM node:latest

EXPOSE 3000

RUN mkdir /app
COPY app.js /app/app.js
COPY client-credentials.json /app/client-credentials.json
COPY package.json /app/package.json

WORKDIR /app

RUN npm install

CMD ["node", "app.js"]
