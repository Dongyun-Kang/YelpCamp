const express = require("express");
const router  = express.Router();
const Campground = require("../models/campground");
const User = require("../models/user");
const Notification = require("../models/notification");
const middleware = require('../middleware');
const NodeGeocoder = require('node-geocoder');

let options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
let geocoder = NodeGeocoder(options);

// INDEX
router.get("/", (req, res) => {
  let noMatch = null;
  let perPage = 8;
  let pageQuery = parseInt(req.query.page);
  let pageNumber = pageQuery ? pageQuery : 1;
  let sortQuery = {createdAt: -1};

  if(req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'gi');
    Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).sort(sortQuery).exec((err, allCampgrounds) => {
      Campground.countDocuments({name: regex}).exec((err, count) => {
        if(err) {
          console.log(err);
          res.redirect("back");
        } else {
          if (!allCampgrounds.length) {
            noMatch = "No campgrounds match that query, please try again.";
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              noMatch: noMatch,
              count: count,
              search: req.query.search
            });
          }
        }
      });
    });
  } else {
    //Get all campgrounds from DB
    Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).sort(sortQuery).exec((err, allCampgrounds) => {
      Campground.countDocuments().exec((err, count) => {
          if (err) {
              console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              noMatch: noMatch,
              count: count,
              search: false
            });
          }
      });
  });
  }
});

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, async (req, res) => {
  // get data from form and add to campgrounds array
  let name = req.body.name;
  let image = req.body.image;
  let desc = req.body.description;
  let price = req.body.price;
  let author = {
    id: req.user._id,
    username: req.user.username
  };
  geocoder.geocode(req.body.location, (err, data) => {
    if (err || !data.length) {
      console.log(err);
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    let lat = data[0].latitude;
    let lng = data[0].longitude;
    let location = data[0].formattedAddress;
    let newCampground = {name: name, image: image, price: price, description: desc, author:author, location: location, lat: lat, lng: lng};
    // Create a new campground and save to DB
    Campground.create(newCampground, async (err, campground) => {
      if(err){
        console.log(err);
      } else {
        try {
          let user = await User.findById(req.user._id).populate('followers').exec();
          let newNotification = {
            username: req.user.username,
            campgroundId: campground.id
          };
          for (const follower of user.followers) {
            let notification = await Notification.create(newNotification);
            follower.notifications.push(notification);
            follower.save();
          }
        } catch (err) {
          req.flash('error', err.message);
          res.redirect('back');
        }
        //redirect back to campgrounds page
        req.flash('success', 'Successfully created new Campground');
        res.redirect(`/campgrounds/${campground.id}`);
      }
    });
  });
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, (req, res) => {
  res.render("campgrounds/new");
});

// need to be after new
// SHOW - shows more info about one campground
router.get("/:id", (req, res) => {
  // find the campground with provided ID
  Campground.findById(req.params.id).populate("comments likes").exec( (err, foundCampground) => {
    if (err || !foundCampground) {
      req.flash('error', 'Campground not found');
      res.redirect('back');
    } else {
      // render show template with that campground
      res.render("campgrounds/show", {campground: foundCampground});
    }
  });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, (err, foundCampground) => {
    res.render('campgrounds/edit', {campground: foundCampground});
  });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:id", middleware.checkCampgroundOwnership, (req, res) => {
  geocoder.geocode(req.body.campground.location, (err, data) => {
    if (err || !data.length) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    req.body.campground.lat = data[0].latitude;
    req.body.campground.lng = data[0].longitude;
    req.body.campground.location = data[0].formattedAddress;

    Campground.findByIdAndUpdate(req.params.id, req.body.campground, (err, campground) => {
      if(err){
        req.flash("error", err.message);
        res.redirect("back");
      } else {
        req.flash("success","Successfully Updated!");
        res.redirect("/campgrounds/" + campground._id);
      }
    });
  });
});

// Campground Like Route
router.post("/:id/like", middleware.isLoggedIn, (req, res) => {
  Campground.findById(req.params.id, (err, foundCampground) => {
    if (err) {
      console.log(err);
      return res.redirect("/campgrounds");
    }

    // check if req.user._id exists in foundCampground.likes
    var foundUserLike = foundCampground.likes.some((like) => {
      return like.equals(req.user._id);
    });

    if (foundUserLike) {
      // user already liked, removing like
      foundCampground.likes.pull(req.user._id);
    } else {
      // adding the new user like
      foundCampground.likes.push(req.user);
    }

    foundCampground.save((err) => {
      if (err) {
        console.log(err);
        return res.redirect("/campgrounds");
      }
      return res.redirect("/campgrounds/" + foundCampground._id);
    });
  });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, (err, campground) => {
    if (err) {
      res.redirect("/campgrounds");
    } else {
      campground.remove();
      res.redirect("/campgrounds");
    }
  })
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;
