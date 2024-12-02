'use strict';

/**
 * dynamic-config controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::dynamic-config.dynamic-config');
