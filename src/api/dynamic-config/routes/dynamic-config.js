'use strict';

/**
 * dynamic-config router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::dynamic-config.dynamic-config');
