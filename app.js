const express                 = require("express"),
    app                     = express(),
    bodyParser              = require("body-parser"),
    mongoose                = require("mongoose"),
    flash                   = require("connect-flash"),
    methodOverride          = require('method-override'),
    passport                = require('passport'),
    LocalStrategy           = require('passport-local'),
    passportLocalMongoose   = require('passport-local-mongoose'),
    Campground              = require("./models/campground"),
    Comment                 = require("./models/comment"),
    User                    = require('./models/user');
    
// requring routes    
const commentRoutes     = require("./routes/comments"),
    campgroundRoutes    = require("./routes/campgrounds"),
    userRoutes          = require("./routes/users"),
    indexRoutes         = require("./routes/index");

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

// /test?retryWrites=true&w=majority
// /YelpCamp?retryWrites=true&w=majority
const url = process.env.YELPCAMPURL || "mongodb://localhost:27017/yelp_camp_v1";
mongoose.connect(url).then(() => {
	console.log('Connected to DB!');
}).catch(err => {
	console.log('Mongoose Error: ' + err.message);
});
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.locals.moment = require('moment');

// PASSPORT CONFIG
app.use(require('express-session')({
	secret: 'My fav coffee origin is Ethiopia',
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
// app.use(express.static(__dirname + "/public"));

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// middleware: using this, no need to pass req.user every time
// It'll call this function on every single route
app.use(async (req, res, next) => {
    res.locals.currentUser = req.user;
    if (req.user) {
      try {
				let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
				res.locals.notifications = user.notifications.reverse();
			} catch (err) {
				console.log(err.message);
			}
    }
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/users", userRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);

app.listen(process.env.PORT || 3000, process.env.IP, function(){
	console.log("The YelpCamp Server Has Started!!!"); 
});