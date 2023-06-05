/* eslint-disable */
const notifier = require('node-notifier');
const path = require('path');

function log(message, ...args) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`[${new Date().toISOString()}] ${message}`, ...args);
}

function notify(message, ...args) {
  notifier.notify({
    title: 'Flagright Console',
    icon: path.resolve(__dirname, 'icon.png'),
    timeout: 5,
    message,
  });
}

module.exports = { notify, log, error };
