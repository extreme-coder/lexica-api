'use strict';

const challenge = require('../routes/challenge');

/**
 * challenge controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::challenge.challenge', ({ strapi }) =>  ({  
  async create(ctx) {
    //create a message of chllenge type
    const response = await strapi.entityService.create('api::message.message', {
      data: {
        gameroom: ctx.request.body.data.gameroom,
        from_player: ctx.request.body.data.from_player,
        to_player: ctx.request.body.data.to_player,
        message_type: 'CHALLENGE',
        publishedAt: new Date(),
        is_read: false,
      }
    });

    let code = ''
    let entries
    do {
      code = Math.random().toString(36).substring(2, 12).toUpperCase()
      entries = await strapi.entityService.findMany('api::challenge.challenge', {        
        filters: { code: code },        
      });
    } while(entries.length > 0)    

    ctx.request.body.data = {
      ...ctx.request.body.data,      
      code: code,
    };
    
    const challenge = await super.create(ctx);
    //fetch the challenge with relations
    const chall = await strapi.entityService.findOne('api::challenge.challenge', challenge.data.id, {
      populate: '*'
    })

    //send message on socket about challenge
    strapi.io.to(ctx.request.body.data.gameroom).emit("challenge", chall)    
    return chall
    
  },

  async update(ctx) {
    const response = await super.update(ctx);
    const challenge = await strapi.entityService.findOne('api::challenge.challenge', response.data.id, {
      populate: '*'
    })
    strapi.io.to(challenge.gameroom.id).emit("challenge_updated", challenge)
    return response
  },

  async joinChallenge(ctx)  {    
    
    const {challengeCd, playerId} = ctx.request.body
    //load challenge by code
    const challenges = await strapi.entityService.findMany('api::challenge.challenge', {
      filters: { code: challengeCd },
      populate: '*'
    })
    if(challenges.length == 0) {
      return ctx.badRequest('Challenge not found', {  })
    }
    let challenge = challenges[0]
    //return error if chalenge is not accepted status
    if(challenge.status != 'ACCEPTED') {
      return ctx.badRequest('Challenge is not accepted', {  })
    }

    //load the user 
    const player = await strapi.entityService.findOne('api::player.player', playerId, {
      populate: '*'
    })

    //login the player
    const jwt = await strapi.plugins['users-permissions'].services.jwt.issue({ id: player.user.id });

    return {jwt: jwt, player: player }
  }
  
}));
