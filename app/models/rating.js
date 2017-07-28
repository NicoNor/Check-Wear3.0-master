// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var ratingSchema = mongoose.Schema({
   email: String,
   score: Number,
   outfitId: mongoose.Schema.ObjectId

});

// create the model for users and expose it to our app
module.exports = mongoose.model('Rating', ratingSchema);
