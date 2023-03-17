'use strict';

/**
 * gameroom controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::gameroom.gameroom', ({ strapi }) =>  ({  
  async create(ctx) {
    
    let code = ''    
    let entries = await strapi.entityService.findMany('api::gameroom.gameroom', {        
      filters: { name: ctx.request.body.data.name },        
    });
    if(entries.length >0) {
      return ctx.badRequest('This name is already taken, please try again', {  })
    }    

    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase()
      entries = await strapi.entityService.findMany('api::gameroom.gameroom', {        
        filters: { join_code: code },        
      });
    } while(entries.length > 0)    

    ctx.request.body.data = {
      ...ctx.request.body.data,
      user: ctx.state.user.id,
      publishedAt: new Date(),      
      join_code: code,
    };

        
    const response = await strapi.entityService.create('api::gameroom.gameroom', ctx.request.body);
    console.log(response)
    return response;
  },

  
}));
