'use strict';

/**
 * chat-template service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::chat-template.chat-template');
