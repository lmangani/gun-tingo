const {Flint} = require('gun-flint');
const GunMongoKey = require('./gun-tingo');
module.exports = Flint.register(GunMongoKey);
