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

// Add Polly configuration
const polly = new AWS.Polly({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION
});

// Helper function to generate audio from text using AWS Polly
async function generateAudio(text, index) {
  try {
    // Configure Polly parameters
    const params = {
      Engine: 'generative',
      LanguageCode: 'en-US',
      OutputFormat: 'mp3',
      Text: text,
      TextType: 'text',
      VoiceId: 'Matthew'
    };

    // Generate speech
    const audioStream = await polly.synthesizeSpeech(params).promise();
    
    // Generate unique filename
    const filename = `lessons/audio/${Date.now()}-${index}-${Math.random().toString(36).substring(7)}.mp3`;

    // Upload to S3
    const uploadResult = await s3.upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      Body: audioStream.AudioStream,
      ContentType: 'audio/mpeg',
      ACL: 'public-read'
    }).promise();

    return uploadResult.Location; // Return the S3 URL
  } catch (error) {
    console.error('Error generating audio:', error);
    throw error;
  }
}

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
    // Check if user has enough credits
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in to create lessons');
    }

    // Get credits per lesson from dynamic config
    const creditsPerLessonConfig = await strapi.entityService.findMany('api::dynamic-config.dynamic-config', {
      filters: {
        name: 'CREDITS_PER_LESSON',
        publishedAt: { $notNull: true }
      }
    });

    if (!creditsPerLessonConfig || creditsPerLessonConfig.length === 0) {
      return ctx.badRequest('Credits per lesson configuration not found');
    }

    const creditsRequired = parseInt(creditsPerLessonConfig[0].value, 10);
    
    if (isNaN(creditsRequired)) {
      return ctx.badRequest('Invalid credits per lesson configuration');
    }

    // Check if user has enough credits
    if (user.credits < creditsRequired) {
      return ctx.badRequest('Not enough credits to create a lesson');
    }



    const { lessonText, videoType, includePractice } = ctx.request.body.data;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY
    });
    const openai = new OpenAIApi(configuration);

    // Updated system prompt to include practice questions when requested
    const systemPrompt = includePractice 
      ? `You are a helpful assistant that divides lesson content into logical 
         small bytes which can be easily consumed by a student to learn the concept. 
         Each section should be 1-2 sentences, the lesson should have 3-4 sections. 
         Use simple language, analogies, make the content easy to understand, as if you are explaining to a teenager.
         Give a small name to the lesson and create practice questions.
         The response should be valid JSON. Don't use markdown. example format: 
         {
           "name": "lesson name",
           "sections": [
             { "section_text": "section 1" },
             { "section_text": "section 2" }
           ],
           "practice": [
             { "front": "Question 1?", "back": "Answer 1" },
             { "front": "Question 2?", "back": "Answer 2" }
           ]
         }`
      : `YYou are a helpful assistant that divides lesson content into logical 
         small bytes which can be easily consumed by a student to learn the concept. 
         Each section should be 1-2 sentences, the lesson should have 3-4 sections. 
         Use simple language, analogies, make the content easy to understand, as if you are explaining to a teenager.
         Give a small name to the lesson as well. The response should be valid JSON.
         Don't use markdown. example format: 
         {
           "name": "lesson name",
           "sections": [
             { "section_text": "section 1" },
             { "section_text": "section 2" }
           ]
         }`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: `This is the lesson text : ${lessonText}`
        }
      ]
    });

    

    // Parse the response to get sections
    const res = JSON.parse(completion.data.choices[0].message.content);

    // Create video entries for each section
    const videoEntries = await Promise.all(res.sections.map(async (section, index) => {
      // Generate audio from transcript
      const audioUrl = await generateAudio(section.section_text, index);

      console.log(audioUrl);
      // Call Pexels API to get images based on section text
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          'Authorization': 'gkMjrxkUs79lfW7bwto3erMyL9LUH73wcCKzl28pVJL5D0z9ytUQlLKB'
        },
        params: {
          query: section.section_text,
          size: 'small',
          per_page: 10
        }
      });
      console.log(response.data.photos);
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
        audio_url: audioUrl
      };
    }));

    console.log(videoEntries);

    // Create the lesson with flashcards if includePractice is true
    const lessonData = {
      name: res.name,
      video_type: videoType,
      video: videoEntries,
      publishedAt: new Date(),
      user: user.id,
    };
    console.log(res.practice);

    // Add flashcards if practice questions were generated
    if (includePractice && res.practice) {
      lessonData.flashcards = res.practice;
    }

    console.log(lessonData);
    const response = await strapi.entityService.create('api::lesson.lesson', {
      data: lessonData
    });

    // Create user-lesson entry for the creator
    await strapi.entityService.create('api::user-lesson.user-lesson', {
      data: {
        user: user.id,
        lesson: response.id,
        publishedAt: new Date()
      }
    });

    // Deduct credits from user
    await strapi.entityService.update('plugin::users-permissions.user', user.id, {
      data: {
        credits: user.credits - creditsRequired
      }
    });

    return response;
  },

  // Add a custom find method to filter lessons by user
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) {
      console.log('No user');
      return ctx.unauthorized('You must be logged in to view lessons');
    }

    // Add user filter to the query
    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      user: user.id
    };
    console.log(ctx.query);

    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  // Update the findOne method to check user-lesson relationship
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in to view lessons');
    }

    const { id } = ctx.params;
    
    // First check if user has access to this lesson via user-lessons
    const userLesson = await strapi.db.query('api::user-lesson.user-lesson').findOne({
      where: { 
        user: user.id,
        lesson: id
      }
    });

    if (!userLesson) {
      return ctx.notFound('Lesson not found or access denied');
    }

    // If user has access, fetch the lesson with populated data
    const entity = await strapi.db.query('api::lesson.lesson').findOne({
      where: { id },
      populate: {
        user: {
          select: ['id', 'username', 'email'],
          populate: {
            profile_pic: true
          }
        },
        video: {
          populate: ['image_urls']
        },
        flashcards: true
      }
    });

    if (!entity) {
      return ctx.notFound('Lesson not found');
    }

    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  // Add this new method inside the controller object
  async shareLesson(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in to share lessons');
    }

    const { lessonId, username } = ctx.request.body;
    
    if (!lessonId || !username) {
      return ctx.badRequest('Lesson ID and username are required');
    }

    try {
      // First verify the lesson exists and the current user has access to it
      const userLesson = await strapi.db.query('api::user-lesson.user-lesson').findOne({
        where: { 
          user: user.id,
          lesson: lessonId
        }
      });

      if (!userLesson) {
        return ctx.forbidden('You do not have access to this lesson');
      }

      // Find the target user by username
      const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { username }
      });

      if (!targetUser) {
        return ctx.notFound('User not found');
      }

      // Check if the target user already has access to this lesson
      const existingShare = await strapi.db.query('api::user-lesson.user-lesson').findOne({
        where: { 
          user: targetUser.id,
          lesson: lessonId
        }
      });

      if (existingShare) {
        return ctx.badRequest('User already has access to this lesson');
      }

      // Create new user-lesson entry for the target user
      const sharedLesson = await strapi.entityService.create('api::user-lesson.user-lesson', {
        data: {
          user: targetUser.id,
          lesson: lessonId,
          publishedAt: new Date(),
          shared_by: user.id
        }
      });

      return {
        success: true,
        message: `Lesson successfully shared with ${username}`
      };

    } catch (error) {
      console.error('Error sharing lesson:', error);
      return ctx.internalServerError('An error occurred while sharing the lesson');
    }
  }
}));
