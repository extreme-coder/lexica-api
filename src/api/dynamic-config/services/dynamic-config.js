'use strict';

/**
 * dynamic-config service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::dynamic-config.dynamic-config');
