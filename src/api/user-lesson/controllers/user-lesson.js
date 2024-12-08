'use strict';

/**
 * user-lesson controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-lesson.user-lesson', ({ strapi }) => ({
  async find(ctx) {
    // Get the current user from the context
    const user = ctx.state.user;
    
    // Add user filter to the query
    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      user: user.id,
    };

    // Add population for lesson and its video components
    ctx.query.populate = {
      lesson: {
        fields: ['id', 'name'],
        populate: {
          video: {
            fields: ['*'],
            populate: {
              image_urls: {
                fields: ['url']
              }
            }
          }
        }
      }
    };

    // Call the default find method with the modified query
    const { data, meta } = await super.find(ctx);
    
    // Transform the response to include only needed fields
    const transformedData = data.map(item => ({
      
        id: item.attributes?.lesson?.data?.id,
        name: item.attributes?.lesson?.data?.attributes?.name,
        thumbnail: item.attributes?.lesson?.data?.attributes?.video?.[0]?.image_urls?.[0]?.url || null
      
    }));
    
    return { data: transformedData, meta };
  }
}));
