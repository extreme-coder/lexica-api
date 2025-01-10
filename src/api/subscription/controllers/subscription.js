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
      // Delete all user-lessons for this user
      const userLessons = await strapi.db.query('api::user-lesson.user-lesson').findMany({
        where: { user: user.id }
      });

      for (const lesson of userLessons) {
        await strapi.entityService.delete('api::user-lesson.user-lesson', lesson.id);
      }

      // Update user to blocked status
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          deleted: true
        }
      });

      return {
        data: {
          message: 'Account successfully deleted'
        }
      };
    } catch (error) {
      console.error('Error deactivating account:', error);
      return ctx.badRequest('Failed to delete account');
    }
  },

  async reinstate_account(ctx) {
    const { user } = ctx.state;
    const { email, username } = ctx.request.body;

    if (!email || !username) {
      return ctx.badRequest('Email and username are required');
    }

    try {
      // Check if user exists and is deleted
      const deletedUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: user.id, deleted: true }
      });

      if (!deletedUser) {
        return ctx.badRequest('User not found or not deleted');
      }

      // Check if new email is already in use by another active user
      const existingUserWithEmail = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { 
          email: email, 
          id: { $ne: user.id },
          deleted: false
        }
      });

      if (existingUserWithEmail) {
        return ctx.badRequest('Email is already in use');
      }

      // Check if new username is already in use by another active user
      const existingUserWithUsername = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { 
          username: username, 
          id: { $ne: user.id },
          deleted: false
        }
      });

      if (existingUserWithUsername) {
        return ctx.badRequest('Username is already in use');
      }

      // Reinstate the account
      const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          deleted: false,
          email: email,
          username: username
        }
      });

      return {
        data: {
          message: 'Account successfully reinstated',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            username: updatedUser.username
          }
        }
      };
    } catch (error) {
      console.error('Error reinstating account:', error);
      return ctx.badRequest('Failed to reinstate account');
    }
  }
}));

