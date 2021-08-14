module.exports = ({ env }) => ({
  email: {
    provider: 'sendgrid',
    providerOptions: {
      apiKey: env('SENDGRID_API_KEY'),
    },
    settings: {
      defaultFrom: env('SENDGRID_SENDER_EMAIL'),
      defaultReplyTo: env('SENDGRID_SENDER_EMAIL'),
    },
  },
})
