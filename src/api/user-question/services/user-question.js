'use strict';

/**
 * user-question service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-question.user-question');
