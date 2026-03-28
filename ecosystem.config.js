module.exports = {
  apps: [{
    name: 'insurance-app',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      DB_HOST: 'localhost',
      DB_USER: 'root',
      DB_PASS: 'your_password',
      DB_NAME: 'insurance_db',
      LINE_CHANNEL_SECRET: 'your_channel_secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'your_channel_access_token',
      ANTHROPIC_API_KEY: 'your_anthropic_api_key',
      APP_URL: 'https://your-domain.com'
    }
  }]
}
