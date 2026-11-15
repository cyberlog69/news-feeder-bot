// src/paths.js
// Single source of truth for the writable data directory.
// Tests set NEWSBOT_DATA_DIR to a temp folder so they never touch production data.

const path = require('path');

const DATA_DIR = process.env.NEWSBOT_DATA_DIR
  ? path.resolve(process.env.NEWSBOT_DATA_DIR)
  : path.join(process.cwd(), 'data');

module.exports = { DATA_DIR };
