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

        // Find eligible PRO subscriptions that need syncing
        const eligibleProSubscriptions = await strapi.entityService.findMany('api::user-subscription.user-subscription', {
          filters: {            
            plan: 'PRO',
            status: 'ACTIVE',
            last_credits_date: {
              $lt: oneMonthAgo
            }
          }
        });

        // First loop: Sync only eligible PRO subscriptions with Apple
        for (const subscription of eligibleProSubscriptions) {
          try {
            await strapi.service('api::apple-transaction.apple-transaction')
              .fetchAndStoreTransactions(subscription);
            strapi.log.info(`Synced Apple transactions for subscription ${subscription.id}`);
          } catch (syncError) {
            strapi.log.error(`Failed to sync Apple transactions for subscription ${subscription.id}:`, syncError);
          }
        }

        // Second loop: Process credits for eligible subscriptions
        // Re-fetch subscriptions to get updated statuses after sync
        const eligibleSubscriptions = await strapi.entityService.findMany('api::user-subscription.user-subscription', {
          filters: {            
            last_credits_date: {
              $lt: oneMonthAgo
            },
            status: 'ACTIVE'
          },
          populate: ['user']
        });

        for (const subscription of eligibleSubscriptions) {
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

        strapi.log.info(`Processed monthly credits for ${eligibleSubscriptions.length} subscriptions`);
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