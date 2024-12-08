'use strict';

module.exports = {
  routes: [
    // Share lesson route
    {
      method: 'POST',
      path: '/lessons/share',
      handler: 'lesson.shareLesson',
      config: {
        policies: [],
        middlewares: [],
      },
    },    
    // You can add more custom routes here
  ],
}; 