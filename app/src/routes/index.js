var express = require('express');
var router = express.Router();

/* GET home (landing) page. */
router.get('/', function(req, res) {
  res.render('dev');
});

router.post('/', function(req, res) {
  res.redirect('/');
})

/* Get login page. TODO: this will replace the dev page as the landing page */
router.get('/login', function(req, res) {
  res.render('login');
});

  /* Attempt login */
  router.post('/login', function(req, res) {
    try
    {
      const {username, password} = req.body;
      const userId = req.db.verifyUser(username, password);

      req.session.user = {id: userId, name: username};

      res.redirect('/home');
    }
    catch (e)
    {
      res.render('login', {error: e.message});
    }
  });

  /* Logout */
  router.post('/logout', function(req, res) {
    req.session.destroy((err) => {
      if (err)
      {
        return console.log(err);
      }
      res.clearCookie('connect.sid', {path: '/'});
      res.redirect('/');
    });
  });

  /* New account page*/
  router.post('/signup', function(req, res) {
    const {username, email} = req.body;

    res.render('signup', { initName: username || '', initEmail: email || '', error: null});
  });

    /* Create account */
    router.post('/register', function(req, res) {
      const {username, email, password1, password2} = req.body;

      if(password1 !== password2)
      {
        res.render('signup', { initName: username, initEmail: email, error: "Passwords do not match."});
      }
      else
      {
        try
        {
          req.db.createUser(username, email, password1);
          res.redirect('/home');
        }
        catch(e)
        {
          console.log(e)
          res.render('signup', { initName: username, initEmail: email, error: "Username already exists."});
        }
      }
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
