'use strict';

/**
 * user-lesson service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-lesson.user-lesson');
