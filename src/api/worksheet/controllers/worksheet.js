'use strict';

/**
 * worksheet controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

module.exports = createCoreController('api::worksheet.worksheet');

module.exports = createCoreController('api::worksheet.worksheet', ({ strapi }) => ({
  async create(ctx) {
    let gpt_request = ctx.request.body.data.gpt_request

    const { Configuration, OpenAIApi } = require("openai");

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const gpt_response = await openai.createCompletion({
      model: "text-davinci-001",
      prompt: gpt_request,
      temperature: 0.4,
      max_tokens: 300,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    console.log(gpt_response.data.choices[0].text)

    const doc = new PDFDocument;
    doc.fontSize(12);
    doc.text(gpt_response.data.choices[0].text);

    // Generate a unique filename for the PDF     
    const filename = `${Date.now()}.pdf`;
    const tmpdir = path.join(__dirname, '..', '../../..', '.tmp'); // Hardcode the temporary folder path
    const filepath = path.join(tmpdir, filename);

    // Save the PDF to disk
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    doc.end();
    await new Promise((resolve) => stream.on('finish', resolve));
    const stats = fs.statSync(filepath);
    const pdfFile = await strapi.plugins.upload.services.upload.upload({
      data: {}, //mandatory declare the data(can be empty), otherwise it will give you an undefined error.
      files: {
        path: filepath,
        name: filename,
        type: 'application/pdf',
        size: stats.size,
      },
    });

    // Delete the temporary file
    fs.unlink(filepath, (err) => {
      if (err) console.log(err);
    });

    ctx.request.body.data = {
      ...ctx.request.body.data,
      file: pdfFile[0].id,
      publishedAt: new Date(),
    };

    const response = await strapi.entityService.create('api::worksheet.worksheet', ctx.request.body);
    return response;
  },


}));
