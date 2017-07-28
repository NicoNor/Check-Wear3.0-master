// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var outfitSchema = mongoose.Schema({
   name: String,
   files: [String],
   email: String,
});


// create the model for users and expose it to our app
module.exports = mongoose.model('Outfit', outfitSchema);
