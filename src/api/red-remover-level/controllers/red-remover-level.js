'use strict';

/**
 * red-remover-level controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::red-remover-level.red-remover-level', ({ strapi }) =>  ({  
  async create(ctx) {
 
    let code = '';
    let entries = [];
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase()
      entries = await strapi.entityService.findMany('api::red-remover-level.red-remover-level', {        
        filters: { guid: code },        
      });
    } while(entries.length > 0)    

    ctx.request.body.data = {
      ...ctx.request.body.data,     
      publishedAt: new Date(),      
      guid: code,
    };

        
    const response = await strapi.entityService.create('api::red-remover-level.red-remover-level', ctx.request.body); 
    return response;
  },

  
}));
