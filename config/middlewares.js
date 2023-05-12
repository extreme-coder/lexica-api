module.exports = [
  'strapi::errors',
  /* Replace 'strapi::security', with this snippet */
      /* Beginning of snippet */
      {
        name: 'strapi::security',
        config: {
          contentSecurityPolicy: {
            useDefaults: true,
            directives: {
              'connect-src': ["'self'", 'https:'],
              'img-src': [
                "'self'",
                'data:',
                'blob:',                
                's3.amazonaws.com',
              ],
              'media-src': [
                "'self'",
                'data:',
                'blob:',                
                's3.us-west-1.amazonaws.com',
              ],
              upgradeInsecureRequests: null,
            },
          },
        },
      },
      /* End of snippet */
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
