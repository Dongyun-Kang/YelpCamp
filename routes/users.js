const express = require("express");
const router  = express.Router({mergeParams: true});
const Campground = require("../models/campground");
const User = require("../models/user");
const middleware = require('../middleware');

// edit user profile
router.get('/:id/edit', middleware.isLoggedIn, (req, res) => {
	res.render('users/edit');
});

// Follow user
router.get('/:id/follow', middleware.isLoggedIn, async (req, res) => {
  try {
    let user = await User.findById(req.params.id).populate('followers').exec();
    if (!user.followers.includes(req.user._id)) {
      user.followers.push(req.user._id);
    }
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// user profile
router.get('/:id', middleware.isLoggedIn, async (req, res) => {
  try {
    let user = await User.findById(req.params.id);
    let campgrounds = await Campground.find().where('author.id').equals(req.params.id).exec();
    res.render('users/profile', {user, campgrounds});
  } catch (err) {
    req.flash("error", err.message);
    return res.redirect('back');
  }
  // User.findById(req.params.id, (err, foundUser) => {
	// 	if(err) {
	// 		req.flash("error", err.message);
	// 		res.redirect("/");
	// 	}
	// 	Campground.find().where('author.id').equals(foundUser._id).exec((err, campgrounds) => {
	// 		if(err) {
	// 			req.flash("error", err.message);
	// 			res.redirect("/");
	// 		}
	// 		res.render('users/profile', {user: foundUser, campgrounds: campgrounds});
	// 	})
	// })
});

// update user profile
router.put('/:id', middleware.isLoggedIn, (req, res) => {
	let rb = req.body;
	User.findByIdAndUpdate(req.params.id, {username: rb.username, firstName: rb.firstName, lastName: rb.lastName, email: rb.email, avatar: rb.avatar}, (err, user) => {
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		} else {
			req.flash("success","Successfully Updated User Profile!");
			res.redirect("/users/" + user._id);
		}
	});
});

module.exports = router;