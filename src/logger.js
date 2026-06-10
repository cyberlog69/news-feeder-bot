// src/logger.js — Colored, timestamped console output

const colors = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m'
};

function ts() {
  return new Date().toLocaleTimeString('en-IN', { hour12: true });
}

module.exports = {
  info:    (msg) => console.log(`${colors.cyan}[${ts()}] ℹ  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[${ts()}] ✔  ${msg}${colors.reset}`),
  error:   (msg) => console.error(`${colors.red}[${ts()}] ✖  ${msg}${colors.reset}`),
  warn:    (msg) => console.warn(`${colors.yellow}[${ts()}] ⚠  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.gray}─── ${msg} ───${colors.reset}`)
};
