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
    const { status = 'ACCEPTED' } = ctx.query; // Get status from query params, default to 'ACCEPTED'

    try {
      // Validate status parameter
      const validStatuses = ['ACCEPTED', 'PENDING'];
      if (!validStatuses.includes(status)) {
        return ctx.badRequest('Invalid status. Must be either ACCEPTED or PENDING');
      }

      // Find all friend records with the specified status where the current user is either the user or friend
      const friendRecords = await strapi.db.query('api::friend.friend').findMany({
        where: {
          status,
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

      // Transform the response to include both friend data and request direction
      const friends = friendRecords.map(record => {
        const isSender = record.user.id === user.id;
        return {
          friend: isSender ? record.friend : record.user,
          direction: isSender ? 'sent' : 'received'
        };
      });

      return { 
        friends,
        status,
        count: friends.length
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // Add this new method inside the controller object
  async removeRequest(ctx) {
    const { username } = ctx.params;
    const { user } = ctx.state;

    try {
      // Find the user by username
      const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { username }
      });

      // Check if user exists
      if (!targetUser) {
        return ctx.notFound('User not found');
      }

      // Find the friend request
      const friendRequest = await strapi.db.query('api::friend.friend').findOne({
        where: {
          user: user.id,
          friend: targetUser.id,
          status: 'PENDING'
        },
        populate: ['user', 'friend']
      });

      // Check if request exists
      if (!friendRequest) {
        return ctx.notFound('No pending friend request found for this user');
      }

      // Delete the friend request
      await strapi.db.query('api::friend.friend').delete({
        where: { id: friendRequest.id }
      });

      return {
        message: 'Friend request cancelled successfully'
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async updateRequest(ctx) {
    const { username } = ctx.params;
    const { action } = ctx.request.body;
    const { user } = ctx.state;

    try {
      // Validate action
      const validActions = ['ACCEPT', 'DECLINE'];
      if (!validActions.includes(action)) {
        return ctx.badRequest('Invalid action. Must be either ACCEPT or DECLINE');
      }

      // Find the user by username
      const requestSender = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { username }
      });

      // Check if user exists
      if (!requestSender) {
        return ctx.notFound('User not found');
      }

      // Find the friend request
      const friendRequest = await strapi.db.query('api::friend.friend').findOne({
        where: {
          user: requestSender.id,
          friend: user.id,
          status: 'PENDING'
        },
        populate: ['user', 'friend']
      });

      // Check if request exists
      if (!friendRequest) {
        return ctx.notFound('No pending friend request found from this user');
      }

      // Update the friend request status based on action
      const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
      await strapi.db.query('api::friend.friend').update({
        where: { id: friendRequest.id },
        data: {
          status: newStatus
        }
      });

      return {
        message: `Friend request ${newStatus.toLowerCase()} successfully`
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  }
}));
