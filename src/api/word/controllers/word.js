'use strict';

/**
 * word controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::word.word', ({ strapi }) =>  ({  
  async getLetterForWord(ctx) {
    //get the word from database based on guid 
    const { word_guid, revealedLetters } = ctx.request.body.data
    const word = await strapi.entityService.findMany('api::word.word', {
      filters: { guid: word_guid },
    });
    //if all letters are already revealed return false
    if(revealedLetters.length >=3) {
      return false;
    }

    //get the letters from the word until its not in revealedLetters
    let loc = Math.floor(Math.random() * word[0].word.length)
    let letter = word[0].word[loc];
    let i = 0;
    while(revealedLetters.includes(letter)) {      
      i++;
      loc = Math.floor(Math.random() * word[0].word.length)
      letter = word[0].word[loc];
    }
    //return the letter
    return {letter: letter, location:loc};
  },

  async getWordForSession(ctx) {
    //get the word-game-session
    const { id } = ctx.params
    
    let wordGameSession = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
      filters: { guid: id },
    });
    
    wordGameSession = wordGameSession[0];
    let filter = { grade: wordGameSession.grade, status:'READY', is_premium: false }
    //check if user has subscription
    if(ctx.state.user) {
      const subscriptions = await strapi.entityService.findMany('api::subscription.subscription', {
        filters: { user: ctx.state.user.id, product: 'WORD_HUNT', status: 'ACTIVE' },
      });
      
      if(subscriptions.length > 0) {
        //remove is_premium from filter if use has subscription
        delete filter.is_premium ;
      }
    }

    if(wordGameSession.join_code) {
      // load stdudent for this join code
      const students = await strapi.entityService.findMany('api::student.student', {
        filters: { join_code: wordGameSession.join_code },
        populate: ['user'],
      });
      // check if the student has a subscription
      if(students.length > 0) {
        const subscriptions = await strapi.entityService.findMany('api::subscription.subscription', {
          filters: { user: students[0].user.id, product: ['WORD_HUNT_30', 'WORD_HUNT_100'], status: 'ACTIVE' },
        });
        
        if(subscriptions.length > 0) {
          //remove is_premium from filter if use has subscription
          delete filter.is_premium ;
        }
      }

    }

    console.log(filter)
    //get all the words 
    const words = await strapi.entityService.findMany('api::word.word', {
      filters: filter,
      populate: ['card_image', 'card_desc']
    });
    //get a random word which until its not in wordGameSession.words
    let word = words[Math.floor(Math.random() * words.length)];
    
    //dont try more than 10 iterations
    let usedWords = []
    if(wordGameSession.words_used) {
      usedWords = wordGameSession.words_used.trim().split(',');
    } 
    let i = 0;
    while(usedWords.includes(word.word)) {
      if(i > 10) {
        break;
      }
      i++;
      word = words[Math.floor(Math.random() * words.length)];
    }
    //if word doesn't have a guid generate one 
    if(!word.guid) {      
      //check if guid is unique
      let entries
      do {
        word.guid = Math.random().toString(36).substring(2, 18).toLowerCase();
        entries = await strapi.entityService.findMany('api::word.word', {
          filters: { guid: word.guid },
        });
      } while(entries.length > 0)
      //update the word with guid
      await strapi.entityService.update('api::word.word', word.id, {
        data: {
          guid: word.guid
        }
      });
    }

    //update the word in wordGameSession
    if(!usedWords.includes(word.word)) {
      await strapi.entityService.update('api::word-game-session.word-game-session', wordGameSession.id, {
        data: {
          words_used: [...usedWords, word.word].join(',')
        }
      });
    }

    //return the word
    return {guid: word.guid, length:word.word.length, card_image: word.card_image};

  },
  async getCardsForSession(ctx) {
    //get the word-game-session for guid 
    const { id } = ctx.params
    let wordGameSession = await strapi.entityService.findMany('api::word-game-session.word-game-session', {
      filters: { guid: id },
    });
    
      


    wordGameSession = wordGameSession[0];
    if(!wordGameSession.cards_collected) {
      wordGameSession.cards_collected = ''
    }
    //check if query parameter has number of cards, return that many number of random cards 
    let randomCards = [];
    if(ctx.query.number) {
      //get random cards from the word-game-session.cards_collected
      const cards = wordGameSession.cards_collected.split(',');
      let i = 0; 
      let j = 0;          
      while(i < ctx.query.number && i < cards.length && j < 25) {
        const card = cards[Math.floor(Math.random() * cards.length)];
        if(!randomCards.includes(card) && card.length <= ctx.query.letters) {
          randomCards.push(card);
          i++;
        }
        j++
      }
    } else {
      //get all the cards from the word-game-session.cards_collected
      randomCards = wordGameSession.cards_collected.split(',');
    }

    //get all the words for the cards_collected
    const words = await strapi.entityService.findMany('api::word.word', {
      filters: { word: randomCards, grade: wordGameSession.grade },
      populate: ['card_image', 'card_desc', 'meaning']
    });
    //return word, card_image and card_desc for each word
    
    return words.map(word => {
      console.log(word)
      return {
        word: word.word,
        card_image: word.card_image,
        card_desc: word.card_desc,
        meaning: word.meaning,
      }
    });

  }

}));