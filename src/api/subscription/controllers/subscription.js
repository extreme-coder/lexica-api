'use strict';

/**
 * subscription controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { createPrivateKey } = require('crypto');
const fs = require('fs');

async function verifyWithAppStoreServer(transactionData) {
  try {
    // Get the issuer ID and key ID from env variables
    const issuerId = process.env.APPLE_ISSUER_ID;
    const keyId = process.env.APPLE_KEY_ID;

    console.log('Using credentials:', {
      issuerId,
      keyId,
      environment: transactionData.environment
    });

    // Determine the environment-specific URL
    const baseUrl = transactionData.environment === 'Sandbox' 
      ? 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1'
      : 'https://api.storekit.itunes.apple.com/inApps/v1';

    // Read and format the private key
    let privateKeyData;
    try {
      privateKeyData = fs.readFileSync('applekey.pem', 'utf8');
      console.log('Successfully read private key from file');
    } catch (err) {
      console.log('Error reading private key file:', err.message);
      console.log('Falling back to environment variable');
      privateKeyData = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    }

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud: 'appstoreconnect-v1',
      bid: transactionData.bundleId // Add bundle ID to the token
    };

    console.log('Creating JWT with payload:', payload);

    const privateKey = createPrivateKey({
      key: privateKeyData,
      format: 'pem',
      type: 'pkcs8'
    });

    // Generate token with more specific options
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT'
      }
    });

    console.log('JWT Token generated successfully');
    
    const requestUrl = `${baseUrl}/transactions/${transactionData.transactionId}`;
    console.log('Making request to:', requestUrl);

    // Call Apple's App Store Server API to verify the transaction
    try {
      const response = await axios.get(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
      if (response.status === 200) {
        const signedTransaction = response.data.signedTransaction;
        
        // Verify the JWS signature
        const publicKeyResponse = await axios.get(`${baseUrl}/public-key`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        const publicKey = publicKeyResponse.data;

        const verifiedData = jwt.verify(signedTransaction, publicKey, {
          algorithms: ['ES256']
        });

        // Compare the verified data with the provided transaction data
        if (verifiedData.transactionId !== transactionData.transactionId ||
            verifiedData.originalTransactionId !== transactionData.originalTransactionId ||
            verifiedData.bundleId !== transactionData.bundleId) {
          throw new Error('Transaction data mismatch');
        }

        return {
          isValid: true,
          verifiedData
        };
      }
      
      throw new Error('Failed to verify with App Store');
    } catch (error) {
      console.error('API call failed:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }

  } catch (error) {
    console.error('App Store verification error:', error);
    return { isValid: false, error: error.message };
  }
}

async function verifyAppleTransaction(transactionData) {
  try {
    // Basic validation of required fields
    if (!transactionData.transactionId || 
        !transactionData.originalTransactionId || 
        !transactionData.productId ||
        !transactionData.bundleId) {
      throw new Error('Missing required transaction data');
    }

    // Verify bundle ID matches our app
    if (transactionData.bundleId !== 'com.thegamebox.Byte') {
      throw new Error('Invalid bundle ID');
    }

    // For sandbox/testing environment (Xcode), skip server verification
    if (transactionData.environment === 'Xcode') {
      return {
        isValid: true,
        productId: transactionData.productId,
        originalTransactionId: transactionData.originalTransactionId,
        transactionId: transactionData.transactionId,
        environment: transactionData.environment
      };
    }

    // For production, verify with Apple's App Store server
    const verificationResult = await verifyWithAppStoreServer(transactionData);
    if (!verificationResult.isValid) {
      throw new Error(`App Store verification failed: ${verificationResult.error}`);
    }

    return {
      isValid: true,
      productId: transactionData.productId,
      originalTransactionId: transactionData.originalTransactionId,
      transactionId: transactionData.transactionId,
      environment: transactionData.environment,
      verifiedData: verificationResult.verifiedData
    };

  } catch (error) {
    console.error('Apple transaction verification error:', error);
    return { isValid: false, error: error.message };
  }
}

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
          const verificationResult = await verifyAppleTransaction(transaction);
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
          credits: 100
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
        const verificationResult = await verifyAppleTransaction(transaction);
        if (!verificationResult.isValid) {
          return ctx.badRequest(`Invalid transaction: ${verificationResult.error}`);
        }

        // Create or update user-subscription entry
        const subscriptionData = {
          user: user.id,
          plan: 'PRO',
          status: 'ACTIVE',
          start_date: new Date(),
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
            trx_id: transaction.originalTransactionId
          }
        });

        if (existingSubscription) {
          // Update existing subscription
          await strapi.entityService.update('api::user-subscription.user-subscription', existingSubscription.id, {
            data: subscriptionData
          });
        } else {
          // Create new subscription
          try {
            await strapi.entityService.create('api::user-subscription.user-subscription', {
              data: subscriptionData
            });
          } catch (error) {
            console.error('Validation error creating subscription:', error);
            if (error.details && error.details.errors) {
              // Log specific validation errors
              error.details.errors.forEach(err => {
                console.error(`Field: ${err.path.join('.')}, Message: ${err.message}`);
              });
            }
            throw error; // Re-throw to be caught by outer catch block
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
  }
}));

