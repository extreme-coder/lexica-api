'use strict';

/**
 * friend controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::friend.friend', ({ strapi }) => ({
  // Keep the default actions
  ...createCoreController('api::friend.friend'),

  // Add friend by username
  async addFriend(ctx) {
    const { username } = ctx.request.body;
    const { user } = ctx.state;

    try {
      // Check if username is provided
      if (!username) {
        return ctx.badRequest('Username is required');
      }

      // Find the user to add as friend
      const friendToAdd = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { username }
      });

      // If user not found
      if (!friendToAdd) {
        return ctx.badRequest('User not found');
      }

      // Check if trying to add self
      if (friendToAdd.id === user.id) {
        return ctx.badRequest('Cannot add yourself as friend');
      }

      // Check if friend request already exists
      const existingRequest = await strapi.db.query('api::friend.friend').findOne({
        where: {
          $or: [
            { user: user.id, friend: friendToAdd.id },
            { user: friendToAdd.id, friend: user.id }
          ]
        }
      });

      if (existingRequest) {
        return ctx.badRequest('Friend request already exists');
      }

      // Create friend request
      const friendRequest = await strapi.db.query('api::friend.friend').create({
        data: {
          user: user.id,
          friend: friendToAdd.id,
          status: 'PENDING',
          publishedAt: new Date()
        }
      });

      return {
        message: 'Friend request sent successfully',
        data: friendRequest
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // Custom action to find friends
  async findMyFriends(ctx) {
    const { user } = ctx.state;

    try {
      // Find all accepted friend records where the current user is either the user or friend
      const friendRecords = await strapi.db.query('api::friend.friend').findMany({
        where: {
          status: 'ACCEPTED',
          $or: [
            { user: user.id },
            { friend: user.id }
          ]
        },
        populate: {
          user: {
            select: ['id', 'username', 'email'],
            populate: {
              profile_pic: true
            }
          },
          friend: {
            select: ['id', 'username', 'email'],
            populate: {
              profile_pic: true
            }
          }
        },
      });

      // Transform the response to return only the friend data
      const friends = friendRecords.map(record => {
        // If the current user is the 'user', return the 'friend' data
        // If the current user is the 'friend', return the 'user' data
        return record.user.id === user.id ? record.friend : record.user;
      });

      return { friends };
    } catch (err) {
      ctx.throw(500, err);
    }
  }
}));
