'use strict';

/**
 * subscription controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::subscription.subscription', ({ strapi }) =>  ({
  // return only user's subscription when finaMany is called
  async find(ctx) {
    const { user } = ctx.state;
    // Inject the user filter into the filters parameter
    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      user: user.id,
    };
    // Call the default find method to get the subscriptions
    const subscriptions = await super.find(ctx);
  
    // Return the subscriptions in the standard response format
    return subscriptions;
  },

  async byte_subscribe(ctx) {
    const { user } = ctx.state;
    const { plan } = ctx.request.body;

    // Validate plan input
    const validPlans = ['NONE', 'MONTHLY', 'YEARLY', '100CREDITS'];
    if (!validPlans.includes(plan)) {
      return ctx.badRequest('Invalid subscription plan');
    }

    try {
      let updateData = {};
      
      if (plan === '100CREDITS') {
        // For credits plan, increment the credits by 100
        const currentCredits = user.credits || 0;
        updateData = {
          credits: currentCredits + 100
        };
      } else {
        // For regular plans, update the subscription plan
        updateData = {
          subscription_plan: plan
        };
      }

      // Update the user
      const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: updateData,
      });

      return {
        data: {
          subscription_plan: updatedUser.subscription_plan,
          credits: updatedUser.credits
        }
      };
    } catch (error) {
      return ctx.badRequest('Failed to update subscription');
    }
  },

  async update_profile_picture(ctx) {
    const { user } = ctx.state;
    
    // Check if files were uploaded
    if (!ctx.request.files || !ctx.request.files.profile_pic) {
      return ctx.badRequest('No file uploaded');
    }

    try {
      // Upload the file using Strapi's upload plugin
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {}, // mandatory declare the data(can be empty), else it will give undefined error
        files: ctx.request.files.profile_pic
      });

      // Update the user's profile_pic field with the uploaded file
      const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          profile_pic: uploadedFiles[0].id // Set the reference to the uploaded file
        },
      });

      return {
        data: {
          profile_pic: uploadedFiles[0]
        }
      };
    } catch (error) {
      console.error(error);
      return ctx.badRequest('Failed to upload profile picture');
    }
  }
}));

