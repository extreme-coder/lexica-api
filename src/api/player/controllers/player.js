'use strict';

/**
 * player controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::player.player', ({ strapi }) =>  ({
  // create a user whenever a player is created (for auth purposes)
  async create(ctx) {
    const { name } = ctx.request.body.data;
    
    //get the game from the request
    const gameroom = await strapi.entityService.findOne('api::gameroom.gameroom', ctx.request.body.data.gameroom );
    //convert name to a valid email address by removing invalid characters from name
    //and appending the game join code to the end
    const email = name.replace(/[^a-zA-Z0-9]/g, '') + '@' + gameroom.join_code + '.com'

    //throw error if the name is already taken
    let entries = await strapi.entityService.findMany('api::player.player', {
      filters: { email: email },
    });
    if(entries.length >0) {
      return ctx.badRequest('This name is already taken, please try again', {  })
    }
    
    const user = await strapi.plugins['users-permissions'].services.user.add({
      username: email,
      email: email,
      password: 'Password!1',
      blocked: false,
      confirmed: true, 
      provider: 'local',
      publishedAt: new Date(),
      role: 3 //  Player role
    });

    //login using this user
    const jwt = await strapi.plugins['users-permissions'].services.jwt.issue({
      id: user.id,
    });


    ctx.request.body.data = {
      ...ctx.request.body.data,
      user: user.id,
      email: email,
      publishedAt: new Date(),
    };
    const response = await strapi.entityService.create('api::player.player', ctx.request.body);    
    return {jwt:jwt, user: response, room: gameroom.join_code};
  },
}));


