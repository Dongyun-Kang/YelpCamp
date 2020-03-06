var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");

// root route
router.get("/", (req, res) => {
	res.render("landing");
});

// show register form
router.get('/register', (req, res) => {
	res.render('register');
});

// handle sign up logic
router.post('/register', (req, res) => {
	let newUser = new User(
		{
			username: req.body.username,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			avatar: req.body.avatar,
			email: req.body.email,
		});
	if(req.body.adminCode === 'secretcode123') {
		newUser.isAdmin = true;
	}
	User.register(newUser, req.body.password, (err, user) => {
		if (err) {
			req.flash("error", err.message);
			return res.redirect('/register');
		}
		passport.authenticate("local")(req, res, () => {
			req.flash("success", "Successfully Signed Up! Nice to meet you " + user.username);
			res.redirect("/campgrounds");
		});
	});
});

// show login form
router.get('/login', (req, res) => {
	res.render("login");
});

// handle login logic
// app.post('/login', middleware, callback) 
router.post('/login', passport.authenticate("local", 
	{
		successRedirect: "/campgrounds",
		failureRedirect: "/login",
		failureFlash: true,
		successFlash: 'Welcome Back to YelpCamp!'
	}), (req, res) => {
});

// logout route
router.get('/logout', (req, res) => {
	req.logout();
	req.flash("success", "Logged you out!");
	res.redirect('/campgrounds');
});

// forgot password
router.get('/forgot', (req, res) => {
	res.render('forgot');
});

// forgot password
router.post('/forgot', (req, res, next) => {
	async.waterfall([
		(done) => {
			crypto.randomBytes(20, (err, buf) => {
				let token = buf.toString('hex');
				done(err, token);
			});
		},
		(token, done) => {
			User.findOne({ email: req.body.email }, (err, user) => {
				if (!user) {
					req.flash('error', 'NO account with that email address exists.');
					return res.redirect('/forgot');
				}
				user.resetPasswordToken = token;
				user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
				user.save((err) => {
					done(err, token, user);
				});
			})
		},
		(token, user, done) => {
			let smtpTransport = nodemailer.createTransport({
				service: 'Gmail',
				auth: {
					user: 'dongyun8338@gmail.com',
					pass: process.env.GMAILPW
				}
			});
			let mailOptions = {
				to: user.email,
				from: 'yelp@camp.com',
				subject: 'YelpCamp Password Reset',
				text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
					'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
					'http://' + req.headers.host + '/reset/' + token + '\n\n' +
					'If you did not request this, please ignore this email and your password will remain unchanged.\n'
			}
			smtpTransport.sendMail(mailOptions, (err) => {
				console.log('mail sent');
				req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
				done(err, 'done');
			});
		}
	], (err) => {
		if (err) return next(err);
		res.redirect('/forgot');
	});
});

// reset password
router.get('/reset/:token', (req, res) => {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, (err, user) => {
		if (!user) {
			req.flash('error', 'Password reset token is invalid or has expired.');
			return res.redirect('/forgot');
		}
		res.render('reset', {token: req.params.token});
	});
});

// reset password
router.post('/reset/:token', (req, res) => {
	async.waterfall([
		(done) => {
			User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, (err, user) => {
				if (!user) {
					req.flash('error', 'Password reset token is invalid or has expired.');
					return res.redirect('back');
				}
				if(req.body.password === req.body.confirm) {
					user.setPassword(req.body.password, (err) => {
						user.resetPasswordToken = undefined;
						user.resetPasswordExpires = undefined;

						user.save((err) => {
							req.logIn(user, (err) => {
								done(err, user);
							});
						});
					})
				} else {
					req.flash("error", "Passwords do not match.");
					return res.redirect('back');
				}
			});
		},
		(user, done) => {
			let smtpTransport = nodemailer.createTransport({
				service: 'Gmail', 
				auth: {
					user: 'dongyun8338@gmail.com',
					pass: process.env.GMAILPW
				}
			});
			let mailOptions = {
				to: user.email,
				from: 'learntocodeinfo@mail.com',
				subject: 'Your password has been changed',
				text: 'Hello,\n\n' +
					'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
			};
			smtpTransport.sendMail(mailOptions, err => {
				req.flash('success', 'Success! Your password has been changed.');
				done(err);
			});
		}
	], (err) => {
		res.redirect('/campgrounds');
	});
});

// user profile
router.get('/users/:id', (req, res) => {
User.findById(req.params.id, (err, foundUser) => {
		if(err) {
			req.flash("error", "Something went wrong.");
			res.redirect("/");
		}
		Campground.find().where('author.id').equals(foundUser._id).exec((err, campgrounds) => {
			if(err) {
				req.flash("error", "Something went wrong.");
				res.redirect("/");
			}
			res.render('users/show', {user: foundUser, campgrounds: campgrounds});
		})
	})
});

module.exports = router;
