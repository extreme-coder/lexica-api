'use strict';

/**
 * subscription controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { createPrivateKey } = require('crypto');
const fs = require('fs');

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
    console.log(ctx.request.body);
    const { plan, transaction } = ctx.request.body;

    // Validate plan input
    const validPlans = ['NONE', 'MONTHLY', 'YEARLY', '100CREDITS'];
    if (!validPlans.includes(plan)) {
      return ctx.badRequest('Invalid subscription plan');
    }

    try {
      if (plan !== 'NONE' && !transaction) {
        return ctx.badRequest('Transaction data is required for paid subscriptions');
      }

      if (plan === '100CREDITS') {
        // Verify transaction for credit purchase
        if (transaction) {
          const verificationResult = await strapi.service('api::user-subscription.transaction-verification').verifyAppleTransaction(transaction);
          if (!verificationResult.isValid) {
            return ctx.badRequest(`Invalid transaction: ${verificationResult.error}`);
          }
          // Verify product ID matches your credit package
          // if (verificationResult.productId !== 'your_credit_product_id') {
          //   return ctx.badRequest('Invalid product purchased');
          // }
        }

        // Use the credit history service to add credits
        await strapi.service('api::credit-history-item.credit-history-item').addCredits({
          user: user.id,
          source: 'ONE_TIME',
          credits: 100,
          original_trx_id: transaction.originalTransactionId
        });

        // Get the updated user to return current credits
        const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id);
        
        return {
          data: {
            subscription_plan: updatedUser.subscription_plan,
            credits: updatedUser.credits
          }
        };
      } else if (plan !== 'NONE') {
        // Verify transaction for subscription
        const verificationResult = await strapi.service('api::user-subscription.transaction-verification').verifyAppleTransaction(transaction);
        if (!verificationResult.isValid) {
          return ctx.badRequest(`Invalid transaction: ${verificationResult.error}`);
        }

        // Create base subscription data without last_credits_date
        const subscriptionData = {
          user: user.id,
          plan: 'PRO',
          status: 'ACTIVE',
          start_date: new Date(transaction.originalPurchaseDate),
          expiry_date: new Date(transaction.expiresDate),
          trx_id: transaction.transactionId,
          originalTransactionId: transaction.originalTransactionId,
          environment: transaction.environment,
          productId: transaction.productId,
          last_verified_at: new Date(),
          publishedAt: new Date()
        };

        // Find existing subscription
        const existingSubscription = await strapi.db.query('api::user-subscription.user-subscription').findOne({
          where: { 
            user: user.id,
            originalTransactionId: transaction.originalTransactionId
          }
        });

        if (existingSubscription) {
          // Update existing subscription
          await strapi.entityService.update('api::user-subscription.user-subscription', existingSubscription.id, {
            data: subscriptionData
          });
        } else {
          // Create new subscription - add last_credits_date only for new subscriptions
          try {
            await strapi.entityService.create('api::user-subscription.user-subscription', {
              data: {
                ...subscriptionData,
                last_credits_date: new Date()  // Add last_credits_date only for new subscriptions
              }
            });
          } catch (error) {
            console.error('Validation error creating subscription:', error);
            if (error.details && error.details.errors) {
              error.details.errors.forEach(err => {
                console.error(`Field: ${err.path.join('.')}, Message: ${err.message}`);
              });
            }
            throw error;
          }
        }

        // Get updated user data
        const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id);

        return {
          data: {
            subscription_plan: updatedUser.subscription_plan,
            credits: updatedUser.credits
          }
        };
      }

      // For NONE plan, just return current user data
      const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id);
      return {
        data: {
          subscription_plan: updatedUser.subscription_plan,
          credits: updatedUser.credits
        }
      };

    } catch (error) {
      console.error(error);
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
  },

  async delete_account(ctx) {
    const { user } = ctx.state;

    try {
      // Find all user subscriptions first
      const userSubscriptions = await strapi.db.query('api::user-subscription.user-subscription').findMany({
        where: { user: user.id }
      });

      // Delete each subscription
      for (const subscription of userSubscriptions) {
        await strapi.entityService.delete('api::user-subscription.user-subscription', subscription.id);
      }

      // Find all credit history items
      const creditHistoryItems = await strapi.db.query('api::credit-history-item.credit-history-item').findMany({
        where: { user: user.id }
      });

      // Delete each credit history item
      for (const item of creditHistoryItems) {
        await strapi.entityService.delete('api::credit-history-item.credit-history-item', item.id);
      }

      // Finally delete the user
      await strapi.entityService.delete('plugin::users-permissions.user', user.id);

      return {
        data: {
          message: 'Account successfully deleted'
        }
      };
    } catch (error) {
      console.error('Error deleting account:', error);
      return ctx.badRequest('Failed to delete account');
    }
  }
}));

