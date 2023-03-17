'use strict';

/**
 * gameroom service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::gameroom.gameroom');
