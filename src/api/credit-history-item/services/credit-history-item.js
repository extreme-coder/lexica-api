'use strict';

/**
 * credit-history-item service
 */

module.exports = {
  async addCredits(data) {
    const { user, source, planId, credits } = data;

    // Get the current user with their credits
    const currentUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      user,
      { fields: ['credits'] }
    );

    let creditHistoryEntry;
    let updatedCredits = currentUser.credits || 0;
    let action = 'ADDED';

    if (source === 'ONE_TIME') {
      // For one-time credits, always add to existing credits
      updatedCredits += credits;
    } else if (source === 'PLAN') {
      // For plan credits, only update if new credits are higher
      if (credits > currentUser.credits) {
        updatedCredits = credits;
        action = 'REPLACED';
      } else {
        // Create history entry with 0 credits if new credits are not higher
        credits = 0;
        updatedCredits = currentUser.credits;
      }
    }

    // Update user credits
    await strapi.entityService.update(
      'plugin::users-permissions.user',
      user,
      {
        data: {
          credits: updatedCredits,
        },
      }
    );

    // Create credit history entry
    creditHistoryEntry = await strapi.entityService.create('api::credit-history-item.credit-history-item', {
      data: {
        user: user,
        credits: credits,
        action: action,
        source: source,
        user_subscription: planId,
        publishedAt: new Date(),
      },
    });

    return creditHistoryEntry;
  },
};