'use strict';

/**
 * dynamic-config service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::dynamic-config.dynamic-config', ({ strapi }) => ({
    // Keep the default core service methods
    ...createCoreService('api::dynamic-config.dynamic-config'),

    // Add custom method to get config by name
    async getConfigByName(name) {
        try {
            const config = await strapi.entityService.findMany('api::dynamic-config.dynamic-config', {
                filters: { name },                
                limit: 1,
            });

            if (!config || config.length === 0) {
                return null;
            }

            return config[0];
        } catch (error) {
            console.error('Error fetching dynamic config:', error);
            throw error;
        }
    }
}));
