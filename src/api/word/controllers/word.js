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
    if((word[0].word.length - revealedLetters.length) <= 3) {
      return false;
    }

    let wordLetters = word[0].word.split('');
    let unrevealedLetterIndices = wordLetters.map((letter, index) => !revealedLetters.includes(letter) ? index : -1).filter(index => index !== -1);
    let loc, letter;
    if (unrevealedLetterIndices.length > 0) {
        let randomIndex = Math.floor(Math.random() * unrevealedLetterIndices.length);
        loc = unrevealedLetterIndices[randomIndex];
        letter = word[0].word[loc];
    } else {
        // All letters have been revealed
        return false;
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
    let words = await strapi.entityService.findMany('api::word.word', {
      filters: filter,
      populate: ['card_image', 'card_desc']
    });
    let usedWords = []
    if(wordGameSession.cards_collected) {
      usedWords = wordGameSession.cards_collected.trim().split(',');
    }
    let word 
    
    console.log(usedWords)

    //if word used is same as all words just pick a random word 
    if(usedWords.length >= words.length) {
      //get a random word      
      word = words[Math.floor(Math.random() * words.length)];
    } else {      
      //remove the used words from words
      let usedWordsSet = new Set(usedWords);
      words = words.filter(w => !usedWordsSet.has(w.word));      
    } 

    //get a random word 
    word = words[Math.floor(Math.random() * words.length)];
    

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