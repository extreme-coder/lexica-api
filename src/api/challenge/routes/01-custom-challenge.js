module.exports = {
  routes: [ 
    { // Path defined with a regular expression
      method: 'POST',
      path: '/challenge/join', // Only match when the URL parameter is composed of lowercase letters
      handler: 'challenge.joinChallenge',
    }
  ]
}