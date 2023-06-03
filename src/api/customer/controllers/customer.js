'use strict';

/**
 * customer controller
 */

const { createCoreController } = require('@strapi/strapi').factories;


const pricePlans_dev = {
  'WORD_HUNT': 'price_1NDAJLCtAcylbX0GGp8t8U2n',
  'WORD_HUNT_30': 'price_1NDAL4CtAcylbX0G2rwJ1bUz',
  'WORD_HUNT_100': 'price_1N4RtxCtAcylbX0GxZWmy0pj'
};

const yerlyPricePlans_dev = {
  'WORD_HUNT': 'price_1NDAJLCtAcylbX0G18faBDbU',
  'WORD_HUNT_30': 'price_1NDAL4CtAcylbX0GTh8WJfyE',
  'WORD_HUNT_100': 'price_1N4RtxCtAcylbX0GxZWmy0pj'
};

const pricePlans = {
  'WORD_HUNT': 'price_1NDAM8CtAcylbX0GesCXximH',
  'WORD_HUNT_30': 'price_1NDANNCtAcylbX0G614hrAGX',
  'WORD_HUNT_100': 'price_1NDANSCtAcylbX0GkY6aB01P'
};

const yerlyPricePlans = {
  'WORD_HUNT': 'price_1NDAM8CtAcylbX0GLYdBGlI7',
  'WORD_HUNT_30': 'price_1NDANNCtAcylbX0G5fnfIOPz',
  'WORD_HUNT_100': 'price_1NDANSCtAcylbX0GNcWeWMqz'
};

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController('api::customer.customer', ({ strapi }) => ({
  async create(ctx) {      
    let stripe_session_id = ctx.request.body.data.sessionId
    const session = await stripe.checkout.sessions.retrieve(stripe_session_id);   
    console.log(session) 
    if (session.payment_status !== 'paid') {          
      //send Error payment failure
      return ctx.badRequest('Payment Failed', {  })
    }   

    ctx.request.body.data = {
      ...ctx.request.body.data,
      user: ctx.state.user.id,
      word_hunt_premium: true,
      publishedAt: new Date(),           
    };

    const lineItems = await stripe.checkout.sessions.listLineItems(stripe_session_id, { limit: 1 });
    const stripePlanId = lineItems.data[0].price.id 
    //find the name based on id from pricePlans object
    const planId = Object.keys(pricePlans).find(key => pricePlans[key] === stripePlanId);

    let numberOfStudents = 1;
    if(planId === 'WORD_HUNT_30') {
      numberOfStudents = 30;
    }

    if(planId === 'WORD_HUNT_100') {
      numberOfStudents = 100;
    }


    const response = await strapi.entityService.create('api::customer.customer', ctx.request.body);    
    //find if there is already a word hunt subscription for user
    const subscriptions = await strapi.entityService.findMany('api::subscription.subscription', {
      filters: { user: ctx.state.user.id, product: planId },
    });
    //if not subscription create one
    if(subscriptions.length === 0) {
      const subscription = await strapi.entityService.create('api::subscription.subscription', {
        data: {
          user: ctx.state.user.id,
          product: planId,
          customer: response.id,
          publishedAt: new Date(),
          stripe_plan_id: stripePlanId,
          number_of_students: numberOfStudents,
        }
      });
      //if number of students is more than 1 create students 
      if(numberOfStudents > 1) {
        for(let i = 0; i < numberOfStudents; i++) {
          //create a unique join_code by creating until it is unique
          let code = '' , entries 
          do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase()
            entries = await strapi.entityService.findMany('api::student.student', {        
              filters: { join_code: code },        
            });
          } while(entries.length > 0)  
          
          await strapi.entityService.create('api::student.student', {
            data: {
              user: ctx.state.user.id,
              subscription: subscription.id,
              join_code: code,
              publishedAt: new Date(),
            }
          });
              
        }
      }
    } 

    return response;
    
  },

  async createSession(ctx) {
    const domainURL = process.env.DOMAIN;
    const {planId, isYearly } = ctx.request.body.data;
    let srtipePlanId = pricePlans[planId];
    if(isYearly) {
      srtipePlanId = yerlyPricePlans[planId];
    }
    
    let urlpath = '/payment-success';
  
    // Create new Checkout Session for the order
    // Other optional params include:
    // [billing_address_collection] - to display billing address details on the page
    // [customer] - if you have an existing Stripe Customer ID
    // [customer_email] - lets you prefill the email input in the form
    // For full details see https://stripe.com/docs/api/checkout/sessions/create
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: srtipePlanId,
            quantity: 1
          },
        ],
        // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
        success_url: `${domainURL}${urlpath}?sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domainURL}${urlpath}`
      });
      
      return ({ sessionId: session.id });
    } catch (e) {
      console.log(e.message)
      ctx.response.status = 400;
      return ({ error: { message: e.message } })
    }
  },

  async checkoutSession(ctx) {
    const { sessionId } = ctx.request.query;            
    const session = await stripe.checkout.sessions.retrieve(sessionId);    

    if (session.payment_status === 'paid') {
      // Payment was successful
      ctx.send({ verified: true, name: session.customer_details.name, email: session.customer_details.email });
    } else {
      // Payment was not successful
      ctx.send({ verified: false });
    }    
  },

  

  

}));

