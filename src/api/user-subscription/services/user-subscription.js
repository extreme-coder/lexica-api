'use strict';

/**
 * user-subscription service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-subscription.user-subscription');
