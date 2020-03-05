var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");

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
    var newUser = new User({username: req.body.username});
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
})

module.exports = router;
