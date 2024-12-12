const user = require('./content-types/User');

module.exports = (plugin) => {    

    //...

    plugin.contentTypes.user = user;

    //...

    return plugin;
}