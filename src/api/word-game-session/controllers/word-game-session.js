'use strict';

/**
 * word-game-session controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::word-game-session.word-game-session', ({ strapi }) =>  ({  
  async create(ctx) {
    
    let code = ''    
    let entries 

    do {
      code = Math.random().toString(36).substring(2, 18).toLowerCase()
      entries = await strapi.entityService.findMany('api::word-game-session.word-game-session', {        
        filters: { guid: code },        
      });
    } while(entries.length > 0)    

    ctx.request.body.data = {
      ...ctx.request.body.data,      
      publishedAt: new Date(),      
      guid: code      
    };

    if(ctx.state.user) {
      ctx.request.body.data.user = ctx.state.user.id
    }    
        
    const response = await strapi.entityService.create('api::word-game-session.word-game-session', ctx.request.body);    
    return response;
  },

  async isPremium(ctx) {    
    //load subscriptioon for the user with product = WORD_HUNT
    const { user } = ctx.state
    const subscriptions = await strapi.entityService.findMany('api::subscription.subscription', {
      filters: { user: user.id, product: ['WORD_HUNT', 'WORD_HUNT_30', 'WORD_HUNT_100'], status: 'ACTIVE' },
    });
    
    //if subscription is active return true
    if(subscriptions.length > 0) {
      // for a premium user load the session from sever
      
      const entries = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
        filters: { user: ctx.state.user.id, status: 'IN_PROGRESS' },
      });
      
      //if there is already an in progress session return that
      if(entries.length > 0) {
        return {premium: true, sessionId: entries[0].guid};
      }
      
      return {premium: true};
    }
    //else return false
    return {premium: false};    
  },

  async isValidStudentCode(ctx) {
    //load the student by join code 
    const { join_code } = ctx.params
    const entries = await strapi.entityService.findMany('api::student.student', {
      filters: { join_code: join_code },
      populate: ['user'],
    });
    //if student is not found return false
    if(entries.length == 0) {
      return {valid: false}
    }
    //check if student has a valid subscription
    const subscriptions = await strapi.entityService.findMany('api::subscription.subscription', {
      filters: { user: entries[0].user.id, product: ['WORD_HUNT_30', 'WORD_HUNT_100'], status: 'ACTIVE' },
    });
    //if subscription is active return true
    if(subscriptions.length > 0) {
      //find the game session for the student join code
      const sessions = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
        filters: { join_code: join_code, status: 'IN_PROGRESS' },
      });
      if(sessions.length >= 1) {
        return {valid: true, sessionId: sessions[0].guid}
      }
      return {valid: true}
    }
    //else return false
    return {valid: false}

  },

  async updateSession(ctx) {
    // get the session by guid 
    let session = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
      filters: { guid: ctx.params.id },
    });
    session = session[0]


    let data = {      
    }
    //if grade is set 
    if (ctx.request.body.data.grade) {
      data.grade = ctx.request.body.data.grade
    }
    //if status is set
    if (ctx.request.body.data.status) {
      data.status = ctx.request.body.data.status
    }
    if(ctx.request.body.data.world) { 
      data.world = ctx.request.body.data.world
    }
    if(ctx.request.body.data.level) {
      data.level = ctx.request.body.data.level
    }
    if(ctx.request.body.data.coins != null) {
      data.coins = ctx.request.body.data.coins
    }

    if(ctx.state.user) {
      data.user = ctx.state.user.id
    }

    console.log(data)
    //update the session with grade and status only 
    const response = await strapi.entityService.update('api::word-game-session.word-game-session', session.id, {
      data: data
    });
    return response;
  },

  async getSession(ctx) {
    // get the session by guid 
    let session = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
      filters: { guid: ctx.params.id },
    });
    session = session[0]
    return session;
  }

  
}));
