// ecosystem.config.js — PM2 Process Manager Configuration
// Used for VPS / bare-metal deployments (DigitalOcean, Oracle Cloud, AWS EC2, etc.)
//
// Usage:
//   npm install -g pm2           # install PM2 globally
//   pm2 start ecosystem.config.js         # start bot
//   pm2 save                              # save process list
//   pm2 startup                           # auto-start on system reboot
//   pm2 logs news-feeder-bot              # view live logs
//   pm2 monit                             # resource monitor
//   pm2 restart news-feeder-bot           # restart
//   pm2 stop news-feeder-bot              # stop
//   pm2 delete news-feeder-bot            # remove from PM2

module.exports = {
  apps: [
    {
      name:         'news-feeder-bot',
      script:       'index.js',
      instances:    1,          // single instance (WhatsApp requires 1)
      autorestart:  true,       // restart on crash
      watch:        false,      // don't watch files (use npm run dev for that)
      max_restarts: 10,         // stop restarting after 10 failures
      restart_delay: 5000,      // wait 5s between restarts
      max_memory_restart: '500M', // restart if memory exceeds 500MB

      // Environment variables
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },

      // Log files — PM2 manages these separately from our app logs
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      error_file:       'data/logs/pm2-error.log',
      out_file:         'data/logs/pm2-out.log',
      merge_logs:       true,

      // Graceful shutdown
      kill_timeout:     5000,   // wait 5s for graceful shutdown before SIGKILL
      listen_timeout:   10000,  // wait 10s for app to start listening

      // Source map support for better error traces
      source_map_support: false,

      // Interpreter options
      node_args: [
        '--max-old-space-size=400'  // limit Node heap to 400MB
      ]
    }
  ]
};
