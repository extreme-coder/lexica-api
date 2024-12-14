module.exports = {
  /**
   * Cron job that runs monthly to add credits to eligible subscriptions
   * Runs at midnight on the first day of each month
   */
  'monthly-subscription-credits': {
    task: async ({ strapi }) => {
      try {
        // Get current date and date 1 month ago
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Find eligible subscriptions
        const subscriptions = await strapi.entityService.findMany('api::user-subscription.user-subscription', {
          filters: {            
            last_credits_date: {
              $lt: oneMonthAgo
            },
            status: 'ACTIVE'
          },
          populate: ['user']
        });

        // Process each subscription
        for (const subscription of subscriptions) {
          console.log('processing subscription');
          console.log(subscription);
          // For PRO plans, verify subscription status with Apple
          if (subscription.plan === 'PRO') {
            // First, sync all transactions for this subscription
            try {
              await strapi.service('api::apple-transaction.apple-transaction')
                .fetchAndStoreTransactions(subscription);
              strapi.log.info(`Synced Apple transactions for subscription ${subscription.id}`);
            } catch (syncError) {
              strapi.log.error(`Failed to sync Apple transactions for subscription ${subscription.id}:`, syncError);
            }

            const transactionData = {
              transactionId: subscription.originalTransactionId,
              originalTransactionId: subscription.originalTransactionId,
              productId: subscription.productId,
              bundleId: 'com.thegamebox.Byte',
              environment: subscription.environment
            };

            const verificationResult = await strapi
              .service('api::user-subscription.transaction-verification')
              .verifyAppleTransaction(transactionData);
            console.log('verificationResult:');
            console.log(verificationResult);
            if (!verificationResult.isValid) {
              strapi.log.warn(`PRO subscription ${subscription.id} failed verification: ${verificationResult.error}`);
              // Update subscription status to EXPIRED
              await strapi.entityService.update('api::user-subscription.user-subscription', subscription.id, {
                data: { status: 'EXPIRED' }
              });
              continue;
            }

            // Extract and decode the signed transaction info
            const signedTransactionInfo = verificationResult.verifiedData?.signedTransactionInfo;
            if (signedTransactionInfo) {
              try {
                // Get just the payload part (second part) of the JWS
                const [, payloadBase64] = signedTransactionInfo.split('.');
                // Decode the base64 payload
                const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
                const transactionInfo = JSON.parse(decodedPayload);

                console.log('Decoded transaction info:', transactionInfo);

                const expirationDate = new Date(transactionInfo.expirationDate);
                const purchaseDate = new Date(transactionInfo.purchaseDate);
                const isTrialPeriod = transactionInfo.type === 'Trial';
                const isUpgraded = transactionInfo.type === 'Upgrade';

                // Update subscription with extracted data
                await strapi.entityService.update('api::user-subscription.user-subscription', subscription.id, {
                  data: {
                    verifiedData: verificationResult.verifiedData,
                    decodedTransactionInfo: transactionInfo, // Store decoded info for reference
                    expirationDate: expirationDate,
                    purchaseDate: purchaseDate,
                    isTrialPeriod: isTrialPeriod,
                    isUpgraded: isUpgraded,
                    lastVerifiedAt: new Date(),
                    // If current date is past expiration, mark as expired
                    status: new Date() > expirationDate ? 'EXPIRED' : 'ACTIVE'
                  }
                });

                // Log the verification details
                strapi.log.info(`Updated subscription ${subscription.id} with verification data:`, {
                  expirationDate,
                  purchaseDate,
                  isTrialPeriod,
                  isUpgraded,
                  status: new Date() > expirationDate ? 'EXPIRED' : 'ACTIVE'
                });
              } catch (decodeError) {
                strapi.log.error(`Failed to decode transaction info for subscription ${subscription.id}:`, decodeError);
                console.log('Raw signedTransactionInfo:', signedTransactionInfo);
              }
            }
          }

          // For FREE plans, check if user has an active PRO plan
          if (subscription.plan === 'FREE') {
            const activeProPlan = await strapi.entityService.findMany('api::user-subscription.user-subscription', {
              filters: {
                user: subscription.user.id,
                plan: 'PRO',
                status: 'ACTIVE'
              }
            });

            // Skip if user has an active PRO plan
            if (activeProPlan.length > 0) {
              strapi.log.info(`Skipping FREE plan credits for user ${subscription.user.id} - has active PRO plan`);
              continue;
            }
          }

          // Determine credits based on plan
          const creditsConfigKey = subscription.plan === 'FREE' ? 'FREE_PLAN_CREDITS' : 'PRO_PLAN_CREDITS';
          
          // Load credits value from dynamic config
          const creditsConfig = await strapi.service('api::dynamic-config.dynamic-config').find({
            filters: { name: creditsConfigKey }
          });

          const creditsToAdd = creditsConfig?.results?.[0]?.value || 0;

          // Add credits
          await strapi.service('api::credit-history-item.credit-history-item').addCredits({
            user: subscription.user.id,
            source: 'PLAN',
            planId: subscription.id,
            credits: creditsToAdd
          });

          // Update lastCreditsDate
          await strapi.entityService.update('api::user-subscription.user-subscription', subscription.id, {
            data: {
              last_credits_date: new Date()
            }
          });
        }

        strapi.log.info(`Processed monthly credits for ${subscriptions.length} subscriptions`);
      } catch (error) {
        strapi.log.error('Error in monthly-subscription-credits cron job:', error);
      }
    },
    options: {
      // run every minute
      rule: '* * * * *', 
    },
  },
}; 