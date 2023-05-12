module.exports = {
  routes: [ 
    { // Path defined with a regular expression
      method: 'GET',
      path: '/word/getword/:id', // Only match when the URL parameter is composed of lowercase letters
      handler: 'word.getWordForSession',
    },
    { // Path defined with a regular expression
      method: 'POST',
      path: '/word/getletter', // Only match when the URL parameter is composed of lowercase letters
      handler: 'word.getLetterForWord',
    },
    { // Path defined with a regular expression
      method: 'GET',
      path: '/word/getcards/:id', // Only match when the URL parameter is composed of lowercase letters
      handler: 'word.getCardsForSession',
    },


    
  ]
}