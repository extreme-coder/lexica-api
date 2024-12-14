'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { createPrivateKey } = require('crypto');
const fs = require('fs');

module.exports = {
  async generateAppStoreToken(bundleId) {
    // Get the issuer ID and key ID from env variables
    const issuerId = process.env.APPLE_ISSUER_ID;
    const keyId = process.env.APPLE_KEY_ID;

    // Read and format the private key
    let privateKeyData;
    try {
      privateKeyData = fs.readFileSync('applekey.pem', 'utf8');
    } catch (err) {
      privateKeyData = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    }

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud: 'appstoreconnect-v1',
      bid: bundleId
    };

    const privateKey = createPrivateKey({
      key: privateKeyData,
      format: 'pem',
      type: 'pkcs8'
    });

    return jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT'
      }
    });
  },

  async fetchAndStoreTransactions(userSubscription) {
    try {
      if (!userSubscription.originalTransactionId) {
        throw new Error('Missing original transaction ID');
      }

      const environment = userSubscription.environment || 'Production';
      const bundleId = 'com.thegamebox.Byte';

      const baseUrl = environment === 'Sandbox' 
        ? 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1'
        : 'https://api.storekit.itunes.apple.com/inApps/v1';

      const token = await this.generateAppStoreToken(bundleId);
      
      const historyUrl = `${baseUrl}/history/${userSubscription.originalTransactionId}`;
      const response = await axios.get(historyUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.data.signedTransactions) {
        console.log('No transactions found');
        return;
      }

      // Process each transaction
      for (const signedTransaction of response.data.signedTransactions) {
        try {
          // Get just the payload part (second part) of the JWS
          const [, payloadBase64] = signedTransaction.split('.');
          // Decode the base64 payload
          const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
          const transactionData = JSON.parse(decodedPayload);
          console.log('transactionData:');
          console.log(transactionData);

          // Check if transaction already exists
          const existingTransaction = await strapi.query('api::apple-transaction.apple-transaction').findOne({
            where: {
              trx_id: transactionData.transactionId
            }
          });

          if (!existingTransaction) {
            // Create new transaction record
            await strapi.entityService.create('api::apple-transaction.apple-transaction', {
              data: {
                trx_id: transactionData.transactionId,
                original_trx_id: transactionData.originalTransactionId,
                expiry_date: new Date(transactionData.expiresDate),
                productId: transactionData.productId,
                environment: environment,
                publishedAt: new Date(),                
              }
            });
          }
        } catch (error) {
          console.error('Error processing transaction:', error);
          continue;
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
};
