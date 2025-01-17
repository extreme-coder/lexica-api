module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/subscriptions/byte-subscribe',
      handler: 'subscription.byte_subscribe',
    },
    {
      method: 'POST',
      path: '/subscriptions/profile-picture',
      handler: 'subscription.update_profile_picture',
    },
    {
      method: 'DELETE',
      path: '/subscriptions/delete-account',
      handler: 'subscription.delete_account',
    },
    {
      method: 'POST',
      path: '/subscriptions/reinstate-account',
      handler: 'subscription.reinstate_account',
    }
  ]
}; 