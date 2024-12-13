'use strict';

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { createPrivateKey } = require('crypto');
const fs = require('fs');

module.exports = {
  async verifyWithAppStoreServer(transactionData) {
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
        bid: transactionData.bundleId
      };

      console.log('Creating JWT with payload:', payload);

      const privateKey = createPrivateKey({
        key: privateKeyData,
        format: 'pem',
        type: 'pkcs8'
      });

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

      try {
        const response = await axios.get(requestUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        console.log('Response status:', response.status);
        
        if (response.status === 200) {
          return {
            isValid: true,
            verifiedData: response.data
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
  },

  async verifyAppleTransaction(transactionData) {
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
      const verificationResult = await this.verifyWithAppStoreServer(transactionData);
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
}; 