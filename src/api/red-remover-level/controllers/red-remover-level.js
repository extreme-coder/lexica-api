'use strict';

/**
 * red-remover-level controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::red-remover-level.red-remover-level', ({ strapi }) =>  ({  
  async create(ctx) {
 
    let code = '';
    
    let entries = await strapi.entityService.findMany('api::red-remover-level.red-remover-level', {        
      filters: { level_code: ctx.request.body.data.level_code },        
    });
    if(entries.length >0) {
      return entries[0]
    }  

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
