var express = require('express');
var router = express.Router();

/* GET home (landing) page. */
router.get('/', function(req, res) {
  res.render('dev');
});

/* Get login page. TODO: this will replace the dev page as the landing page */
router.get('/login', function(req, res) {
  res.render('login');
});

/* Get home page. (World selection/creation) */
router.get('/home', function(req, res) {
  res.render('home', {user: "Boblin the Goblin" }); /* TODO: Create secure means of logging in */
});

/* Get world page. (Contains links to notes pages) */
router.get('/world', function(req, res) {
  res.render('world', {worldName: "Kingdom of Placeholderia"});
});

/* Get character page */
router.get('/character', function(req, res) {
  res.render('character', {characterName: "Sir Exel Pixelart"});
});

module.exports = router;
