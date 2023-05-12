'use strict';

/**
 * subscription controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::subscription.subscription', ({ strapi }) =>  ({
  // return only user's subscription when finaMany is called
  async find(ctx) {
    const { user } = ctx.state;
    // Inject the user filter into the filters parameter
    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      user: user.id,
    };
    // Call the default find method to get the subscriptions
    const subscriptions = await super.find(ctx);
  
    // Return the subscriptions in the standard response format
    return subscriptions;
  }
}));

