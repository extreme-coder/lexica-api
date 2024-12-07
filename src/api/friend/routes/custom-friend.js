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
    }
  ],
}; 