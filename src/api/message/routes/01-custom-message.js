module.exports = {
  routes: [ 
    { // Path defined with a regular expression
      method: 'POST',
      path: '/messages/read', // Only match when the URL parameter is composed of lowercase letters
      handler: 'message.messagesRead',
    }
  ]
}