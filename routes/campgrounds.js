const express = require("express");
const router  = express.Router();
const Campground = require("../models/campground");
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
  // eval(require('locus')); // for debugging
  let noMatch = null;
  if(req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'gi');
    //Get all campgrounds from DB
    Campground.find({name: regex}, (err, allCampgrounds) => {
      if(err) {
        console.log(err);
      } else {
        if (!allCampgrounds.length) {
          noMatch = "No campgrounds match that query, please try again.";
        }
        res.render("campgrounds/index", {campgrounds: allCampgrounds, noMatch: noMatch});
      }
    })
  } else {
    //Get all campgrounds from DB
    Campground.find({}, (err, allCampgrounds) => {
      if(err) {
        console.log(err);
      } else {
        res.render("campgrounds/index", {campgrounds: allCampgrounds, noMatch: noMatch});
      }
    })
  }
});

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, function(req, res){
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
    Campground.create(newCampground, (err, newlyCreated) => {
      if(err){
        console.log(err);
      } else {
        //redirect back to campgrounds page
        req.flash('success', 'Successfully created new Campground');
        res.redirect("/campgrounds");
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
  Campground.findById(req.params.id).populate("comments").exec( (err, foundCampground) => {
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
      req.flash('error', 'Invalid addr');
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
