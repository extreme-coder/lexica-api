module.exports = {
  async afterCreate(event) {
    // First fetch the complete entity with populated relations
    const populatedResult = await strapi.entityService.findOne('api::user-subscription.user-subscription', event.result.id, {
      populate: ['user']
    });
    
    console.log('UserSubscription afterCreate - populated result:', populatedResult);

    if (!populatedResult.user) {
      console.error('UserSubscription afterCreate - No user found in populated result:', populatedResult);
      return;
    }

    // Get the plan type and determine credits from dynamic config
    let creditsConfigKey = 'PRO_PLAN_CREDITS';
    if (populatedResult.plan === 'FREE') {
      creditsConfigKey = 'FREE_PLAN_CREDITS';
    }

    // Load credits value from dynamic config
    const creditsConfig = await strapi.service('api::dynamic-config.dynamic-config').find({
      filters: { name: creditsConfigKey }
    });

    const creditsToAdd = creditsConfig?.results?.[0]?.value || 0;
    
    try {
      // Add credits when subscription is created
      await strapi.service('api::credit-history-item.credit-history-item').addCredits({
        user: populatedResult.user.id,
        source: 'PLAN',
        planId: populatedResult.id,
        credits: creditsToAdd
      });
    } catch (error) {
      console.error('Error in UserSubscription afterCreate:', error);
      throw error;
    }
  }
}; 