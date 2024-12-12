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
            plan: {
              $in: ['FREE', 'PRO']
            },
            lastCreditsDate: {
              $lt: oneMonthAgo
            },
            status: 'ACTIVE'
          },
          populate: ['user']
        });

        // Process each subscription
        for (const subscription of subscriptions) {
          // Determine credits based on plan
          const creditsConfigKey = subscription.plan === 'FREE' ? 'FREE_PLAN_CREDITS' : 'PRO_PLAN_CREDITS';
          
          // Load credits value from dynamic config
          const creditsConfig = await strapi.service('api::dynamic-config.dynamic-config').find({
            filters: { key: creditsConfigKey }
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
              lastCreditsDate: now
            }
          });
        }

        strapi.log.info(`Processed monthly credits for ${subscriptions.length} subscriptions`);
      } catch (error) {
        strapi.log.error('Error in monthly-subscription-credits cron job:', error);
      }
    },
    options: {
      rule: '0 0 1 * *', // Run at midnight on the first day of each month
    },
  },
}; 