module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/friends/me',
      handler: 'friend.findMyFriends'
    },
    {
      method: 'POST',
      path: '/friends/add',
      handler: 'friend.addFriend',      
    },
    {
      method: 'DELETE',
      path: '/friends/request/:username',
      handler: 'friend.removeRequest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/friends/request/:username',
      handler: 'friend.updateRequest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 