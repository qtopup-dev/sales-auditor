module.exports = {
  apps: [
    {
      name: 'alejinput-api',
      script: 'packages/backend/dist/index.js',
      cwd: '/var/www/alejinput',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        TZ: 'UTC',
      },
    },
  ],
};
