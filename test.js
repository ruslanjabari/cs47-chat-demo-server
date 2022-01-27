const ws = require('ws');

// const w1 = new ws('ws://localhost:3010').on('open', (ws) => {
//   w1.send('message;_;Hello World!');
//   setTimeout(() => {
//     w1.close();
//   }, 5000);
// });
// setTimeout(() => {
//   const w2 = new ws('ws://localhost:3009').on('open', (ws) => {
//     w2.send('message;_;Hello World 2!');
//     setTimeout(() => {
//       w2.close();
//     }, 5000);
//   });
// }, 15000);

const w3 = new ws('ws://localhost:3010')
  .on('open', (ws) => {
    w3.send('message;_;Hello World 3!');
    setTimeout(() => w3.close(), 5000);
  })
  .on('message', (message) => console.log(message.toString()));
