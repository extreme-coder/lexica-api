'use strict';

/**
 * lesson controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { OpenAIApi, Configuration } = require('openai');
const axios = require('axios');
const sharp = require('sharp');
const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION
});

// Helper function to download, process and upload image
async function processAndUploadImage(imageUrl) {
  try {
    // Download image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Process image with sharp
    const processedImage = await sharp(buffer)
      .resize(800, 600, { // Adjust dimensions as needed
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate unique filename
    const filename = `lessons/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    // Upload to S3
    const uploadResult = await s3.upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    }).promise();

    return uploadResult.Location; // Return the S3 URL
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

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
          Also for each section, we will search for images, so we need 2 words that describe the section to use for image search.         
          The response should be a JSON. Don't use markdown. example format: 
          {name: 'lesson name', sections: [{section_text: 'section 1', section_keywords: 'keyword1 keyword2']}, {section_text: 'section 2', section_keywords: 'keyword3 keyword4'}]}`
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
          query: section.section_keywords,
          size: 'small',
          per_page: 10
        }
      });

      // Randomly select 3 images and process them
      const photos = response.data.photos;
      const selectedImages = [];
      for(let i = 0; i < 3 && photos.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * photos.length);
        const s3Url = await processAndUploadImage(photos[randomIndex].src.original);
        selectedImages.push({ url: s3Url });
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
