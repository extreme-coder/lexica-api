module.exports = {
  async afterCreate(event) {
    const { result } = event;
    
    // Create user subscription entry
    await strapi.entityService.create('api::user-subscription.user-subscription', {
      data: {
        user: result.id,
        plan: 'FREE',
        status: 'ACTIVE',
        start_date: new Date(),
        publishedAt: new Date(),
        last_credits_date: new Date()
      }
    });
  }
}; 