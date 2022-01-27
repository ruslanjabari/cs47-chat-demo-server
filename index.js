const usock = require('uWebSockets.js');
const server = usock.App({});
const { readFileSync } = require('fs');
const names = JSON.parse(readFileSync('./PARSED_MOCK_DATA.json').toString());
const Redis = require('ioredis');
Redis.Promise = require('bluebird');
const sub = new Redis({ lazyConnect: true, port: 6379, host: '127.0.0.1' });
const client = new Redis({ lazyConnect: true, port: 6379, host: '127.0.0.1' });

// const util = require('util');
const { randomUUID } = require('crypto');
const redisID = randomUUID();
const assert = require('assert');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3010;
let clients = [];

server
  .ws('/*', {
    upgrade: async (res, req, ctx) => {
      try {
        res.upgrade(
          {
            ipbuff: res.getRemoteAddressAsText(),
            ip: await req.getHeader('host'),
          },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          ctx
        );
      } catch (err) {
        log_err(err);
      }
    },
    open: async (ws) => {
      // check redis for { ipbuff: 'username' }
      try {
        const { ip, ipbuff } = ws;
        const ipaddr = Buffer.from(ipbuff).toString();
        // if null, assign a new username from random list
        if (!(await client.hexists('clients', ipaddr))) {
          const username = JSON.stringify(names[Math.floor(Math.random() * 400)].username);
          await client.hset('clients', ipaddr, username);
          process.stdout.write(`\x1b[1m\x1b[34m 🚀🚀 ${username}:${ip} joined the chat!\n`);
          ws.send(`user-creds;${username}`);
        } else {
          const username = await client.hget('clients', ipaddr);
          process.stdout.write(`\x1b[1m\x1b[34m 🙋🙋 ${username}:${ip} rejoined the chat!\n`);
          ws.send(`user-creds;${username}`);
        }
        await client.sadd('active', ipbuff);
        clients.push(ws);
        const messages = await client.lrange('messages', 0, -1);
        ws.send(`sync;${messages.join(',')}`);
      } catch (err) {
        log_err(err);
      }
    },
    message: async (ws, message) => {
      try {
        const time = new Date().getTime();
        const buffer = Buffer.from(message).toString();
        const [isValid, _, data] = buffer.split(';');

        const { ipbuff } = ws;
        const ipaddr = Buffer.from(ipbuff).toString();
        //   if session is invalid, return
        if (!(await client.sismember('active', ipbuff))) {
          process.stderr.write(
            `\x1b[1m\x1b[31m 🗿🗿🗿 Invalid request: ${ws.ip} is not connected\n`
          );
          return;
        }
        const username = await client.hget('clients', ipaddr);
        if (isValid !== 'message') {
          process.stderr.write(`\x1b[1m\x1b[31m 🛑🛑🛑 Invalid message ${message}\n`);
          return;
        }
        process.stdout.write(
          `\x1b[1m\x1b[31m ${time.toLocaleString()}: 📝📝📝  ${username}:${ws.ip}-> ${data}\n`
        );
        let msg = { message: data, timestamp: time, sender: username };
        await client.rpush('messages', JSON.stringify(msg));
        msg.publisherID = redisID;
        client.publish('broadcast', JSON.stringify(msg));
      } catch (err) {
        log_err(err);
      }
    },
    close: (ws, _, __) => {
      try {
        const { ipbuff, ip } = ws;
        client.srem('active', ipbuff);
        clients = clients.filter((client) => client != ws);
        process.stdout.write(`\x1b[1m\x1b[33m 👋👋 ${ip} left the chat!\n`);
      } catch (err) {
        log_err(err);
      }
    },
  })
  .listen(PORT, async (_) => {
    try {
      await client.connect();
      await sub.connect();
      client.once('ready', () => {
        // bluebird is, for some reason, too fast to catch the ready event
        assert.equal(client.get().constructor, require('bluebird'));
      });
      process.stdout.write(`\x1b[1m\x1b[32m 🔥🔥🔥 listening on port ${PORT}\n`);

      sub.subscribe('broadcast', (err, _) => {
        if (err) log_err(err);
      });
      sub.on('message', (channel, data) => {
        const { message, timestamp, sender, publisherID } = JSON.stringify(data);
        if (channel === 'broadcast' && publisherID != redisID) {
          clients.forEach((client) => {
            const data = { message: message, timestamp: timestamp, sender: sender };
            client.send(`${data}`);
          });
        }
      });
      // client.monitor(function (err, monitor) {
      //   // Entering monitoring mode.
      //   monitor.on('monitor', function (time, args, source, database) {
      //     console.log(time + ': ' + util.inspect(args) + '\n' + source + '\n' + database);
      //   });
      // });
    } catch (err) {
      log_err(err);
      process.exit(0);
    }
  });

const log_err = (err) => {
  process.stderr.write(
    `\x1b[1m\x1b[31m 😱🙉🙀 ${JSON.stringify(err)}\n Stack trace: \n${new Error().stack}\n`
  );
};
