'use strict';

/**
 * country service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::message.message', ({ strapi }) => ({
  async getTemplateMessage(type) {    
    //load the chat template for message 
    let messageRes = await strapi.entityService.findMany('api::chat-template.chat-template', {
      filters: { type: type },
    })
    //get a random response
    let message = messageRes[0].messages.split('\n')              
    return message[Math.floor(Math.random() * message.length)]
  },

}));