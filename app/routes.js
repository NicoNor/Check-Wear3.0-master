var async = require('async');
var formidable = require('formidable');
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var randomstring = require("randomstring");
var Outfit = require('../app/models/outfit.js');
var Rating = require('../app/models/rating.js');
var mongoose = require('mongoose');
var request = require('request');

var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, process.env.PWD + '/uploads/');
  },
  filename: function (req, file, callback) {
    callback(null, Date.now() + '-' + file.originalname);
  }
});
var upload = multer({ storage : storage }).array('file',3);

module.exports = function(app, passport) {

   // =====================================
   // HOME PAGE (with login links) ========
   // =====================================
   app.get('/', function(req, res) {
      res.render('index.ejs'); // load the index.ejs file
   });

   // =====================================
   // LOGIN ===============================
   // =====================================
   // show the login form
   app.get('/login', function(req, res) {
      // render the page and pass in any flash data if it exists
      res.render('login.ejs', { message: req.flash('loginMessage') });
   });

   // process the login form
   app.post('/login', passport.authenticate('local-login', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/login', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
   }));

   // =====================================
   // SIGNUP ==============================
   // =====================================
   // show the signup form
   app.get('/signup', function(req, res) {

      // render the page and pass in any flash data if it exists
      res.render('signup.ejs', { message: req.flash('signupMessage') });
   });

   // process the signup form
   app.post('/signup', passport.authenticate('local-signup', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/signup', // redirect back to the signup page if there is an error
      failureFlash : true, // allow flash messages
   }
));

   // =====================================
   // PROFILE SECTION =====================
   // =====================================
   // we will want this protected so you have to be logged in to visit
   // we will use route middleware to verify this (the isLoggedIn function)
   app.get('/profile', isLoggedIn, function(req, res) {
      res.render('profile.ejs', {
         user : req.user // get the user out of session and pass to template
      });
   });

   app.get('/outfits', isLoggedIn, function(req, res) {
      var email = ((req.user.local && req.user.local.email) || (req.user.facebook && req.user.facebook.email))
      var outfits, ratings = {}, total = {};
      async.waterfall([
      function(cb) {
         if (req.query.mine){
            Outfit.find({'email' :  email}, cb);
         }
         else {
            Outfit.find({}, cb);
         }
      },
      function(results, cb) {
         outfits = results;
         Rating.aggregate([
            {
               $group : {
                  _id : "$outfitId",
                  total : {
                     $sum : "$score"
                  }
               }
            }
         ], cb);
      },
      function(results, cb){
         results.forEach(function(rating) {
            total[rating._id] = rating.total;
         });
         Rating.find({email: email}, cb);
      }],
      function(err, results) {
         if (!err) {
            results.forEach(function(rating) {
               ratings[rating.outfitId] = rating.score;
            });
            var data = {outfits:[], ratings: ratings, total: total, email: email};
            outfits.forEach(function(outfit) {
               data.outfits.push(outfit);
            });
            res.render('outfits.ejs', data);
         }
         else {
            console.log(err);
            res.status(500).end();
         }
      });

   });
   app.get('/delete/outfits', function(req, res){
      var outfitId = mongoose.Types.ObjectId(req.query.outfitId);
      async.waterfall([
      function(cb) {
         console.log(outfitId);
         Outfit.remove({_id: outfitId}, cb);
      },
      function(results, cb) {
         Rating.deleteMany({outfitId: outfitId}, cb);
      }],
      function (err, results) {
         if (!err) {
            res.redirect('/outfits');
         }
         else {
            console.log(err);
         }
      }
   );
   })

   app.post('/outfits', function(req, res) {
      async.waterfall([
         function(cb) {
            upload(req, res, function(err, results) {
               if(err) {
                  return res.end("Error uploading file.");
               }
               else {
                  var paths = []
                  req.files.forEach(function(file){
                     paths.push(file.filename);
                  });
                  req.body.url.forEach(function(url) {
                     if (url)
                        paths.push(url);
                  });
                  var outfit = new Outfit({
                     name: req.body.name,
                     files: paths,
                     email: (req.user.local && req.user.local.email) || (req.user.facebook && req.user.facebook.email)
                  });
                  async.waterfall([
                  function(cb) {
                     outfit.save(cb);
                  }],
                  function(err, results) {
                     if (!err) {
                        cb(null, results)
                     }
                     else {
                        console.log(err);
                        cb(err);
                     }
                  });
               }
           });
        }],
      function(err, results){
         if (!err) {
            res.redirect(303, '/outfits');
         }
         else {
            res.redirect(303, '/outfits');
            console.log(err);
         }
      });
   });


    // =====================================
    // FACEBOOK ROUTES =====================
    // =====================================
    // route for facebook authentication and login
    app.get('/auth/facebook', passport.authenticate('facebook', { scope : ['publish_actions','email'] }));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect : '/profile',
            failureRedirect : '/'
   }));

   app.put('/ratings', function(req, res){
      Rating.findOneAndUpdate({email: req.body.email, outfitId: req.body.outfitId}, req.body, {upsert:true}, function(err, doc){
         if (err) return res.send(500, { error: err });
         console.log(req.body);
         res.status(200).end();
      });
   });

    // route for logging out
    app.get('/logout', function(req, res) {

        req.logout();
        res.redirect('/');
    });


    app.get('/unlink/local', function(req, res) {
           var user            = req.user;
           user.local.email    = undefined;
           user.local.password = undefined;
           user.save(function(err) {
               res.redirect('/profile');
           });
       });

       // facebook -------------------------------
       app.get('/unlink/facebook', function(req, res) {
           var user            = req.user;
           user.facebook.token = undefined;
           user.save(function(err) {
               res.redirect('/profile');
           });
       });


       // =============================================================================
       // AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
       // =============================================================================
       	// facebook -------------------------------

       		// send to facebook to do the authentication
       		app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

       		// handle the callback after facebook has authorized the user
       		app.get('/connect/facebook/callback',
       			passport.authorize('facebook', {
       				successRedirect : '/profile',
       				failureRedirect : '/'
       			}));


    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });
};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}
