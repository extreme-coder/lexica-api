'use strict';

/**
 * lesson controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { OpenAIApi, Configuration } = require('openai');
const axios = require('axios');

module.exports = createCoreController('api::lesson.lesson', ({ strapi }) => ({
  async create(ctx) {
    const { lessonText } = ctx.request.body.data;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY
    });
    const openai = new OpenAIApi(configuration);

    // Ask ChatGPT to divide the lesson into sections
    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that divides lesson content into logical 
          small bytes which can be easily consumed by a student to learn the concept. Give a small name to the lesson as well.           
          The response should be a JSON. example format: 
          {name: 'lesson name', sections: [{section_text: 'section 1'}, {section_text: 'section 2'}]}`
        },
        {
          role: "user", 
          content: `This is the lesson text : ${lessonText}`
        }
      ]
    });

    console.log(completion.data.choices[0]);

    // Parse the response to get sections
    const res = JSON.parse(completion.data.choices[0].message.content);

    // Create video entries for each section
    const videoEntries = await Promise.all(res.sections.map(async section => {
      // Call Pexels API to get images based on section text
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          'Authorization': 'gkMjrxkUs79lfW7bwto3erMyL9LUH73wcCKzl28pVJL5D0z9ytUQlLKB'
        },
        params: {
          query: section.section_text,
          size: 'small',
          per_page: 10 // Get 10 images to randomly select from
        }
      });

      // Randomly select 3 images from the response
      const photos = response.data.photos;
      const selectedImages = [];
      for(let i = 0; i < 3 && photos.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * photos.length);
        selectedImages.push({url: photos[randomIndex].src.original});
        photos.splice(randomIndex, 1);
      }

      return {
        transcript: section.section_text,
        image_urls: selectedImages,
      };
    }));

    console.log(videoEntries);

    const response = await strapi.entityService.create('api::lesson.lesson', {
      data: {
        name: res.name,
        video: videoEntries,
        publishedAt: new Date(),
      }
    });

    return response;
  }
}));
