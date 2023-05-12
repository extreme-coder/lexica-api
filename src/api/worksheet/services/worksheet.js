'use strict';

/**
 * worksheet service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::worksheet.worksheet');
