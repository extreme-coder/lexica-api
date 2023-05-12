module.exports = {
  routes: [ 
    { // Path defined with a regular expression
      method: 'PUT',
      path: '/word-game-sessions/:id',
      handler: 'word-game-session.updateSession',
    },
    { // Path defined with a regular expression
      method: 'GET',
      path: '/word-game-sessions/:id',
      handler: 'word-game-session.getSession',
    },
    { // Path defined with a regular expression
      method: 'GET',
      path: '/word-game-sessions/user/is_premium',
      handler: 'word-game-session.isPremium',
    },
    { // Path defined with a regular expression
      method: 'GET',
      path: '/word-game-session/student/is_valid_code/:join_code',
      handler: 'word-game-session.isValidStudentCode',
    }
    

  ]
}