module.exports = {
  routes: [
      { // Path defined with an URL parameter
          method: 'POST',
          path: '/create_checkout_session', 
          handler: 'customer.createSession',
      },
      { // Path defined with a regular expression
          method: 'GET',
          path: '/checkout_session', // Only match when the URL parameter is composed of lowercase letters
          handler: 'customer.checkoutSession',
      }
  ]
}