var express = require('express');
var router = express.Router();

/* Authentication middleware. Reroute to main on failed authentication */
function checkAuth(req, res, next)
{
  if(req.session.user)
  {
    return next();
  }
  res.redirect('/');
}

/* Dev page with links to various views. TODO: Delete when done */
router.get('/dev', function(req, res) {
  res.render('dev');
});

/* Get login page. */
router.get('/', function(req, res) {
  res.render('login');
});

/* Safety blocking function for handling duplicate/incorrect requests */
router.post('/', function(req, res) {
  res.redirect('/');
});

  /* Attempt login. Do NOT Authenticate first! */
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
      console.log(e);
      res.render('login', {error: e.message});
    }
  });

  /* Logout. Use 'post' v. 'get' to prevent CSRF attacks */
  router.post('/logout', checkAuth, function(req, res) {
    req.session.destroy((err) => {
      if (err)
      {
        return console.log(err);
      }
      res.clearCookie('connect.sid', {path: '/'});
      res.redirect('/');
    });
  });

  /* New account page. Do NOT authenticate first! */
  router.post('/signup', function(req, res) {
    const {username, email} = req.body;

    res.render('signup', { initName: username || '', initEmail: email || '', error: null});
  });

    /* Create account. Do NOT authenticate first! */
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
          const userId = req.db.createUser(username, email, password1);
          req.session.user = { id: userId, name: username };
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
router.get('/home', checkAuth, function(req, res) {
  res.render('home', {user: req.session.user.name });
});

/* Get "create collection" page. */
router.get('/createCollection', checkAuth, function(req, res) {
  res.render('createCollection', {error: null});
});

  /* Attempt to create new collection in the database. */
  router.post('/addCollection', checkAuth, function(req, res) {
    const{name} = req.body;
    const userId = req.session.user.id;
    try
    {
      const collections = req.db.getCollectionsByUser(userId);
      if(req.db.nameAlreadyExists(collections, name))
      {
         res.render('createCollection', {error: "A collection with that name already exists."});
         return;
      }

      const result = req.db.createCollection(name, userId);

      res.redirect(`/collection/${result.lastInsertRowid}`);
    }
    catch(e)
    {
      console.log(e);
      res.render('createCollection', {error: e.message});
    }
  });

/* Get World by ID */
router.get('/collection/:id', checkAuth, function(req, res) {
  const collectionId = req.params.id;
  const userId = req.session.user.id;
  try
  {
    const data = req.db.getCollection(collectionId, userId);
    if(!data)
    {
      return res.status(404).send("Collection not found.");
    }

    res.render('world', {world: data});
  }
  catch(e)
  {
    console.log(e);
    res.render('home', {error: "Failed to load collection."});
  }
});








/* Get "create entry" page. */
router.get('/createEntry', checkAuth, function(req, res) {
  const {collectionId, entryType} = req.body;
  res.render('newEntry', {collectionId: collectionId, entryType: entryType, error: null});
});

  /* Attempt to create new collection in the database. */
  router.post('/addEntry', checkAuth, function(req, res) {
    const{collectionId, entryType, name} = req.body;
    const userId = req.session.user.id;

    try
    {
      switch(entryType)
      {
        case 'character':
          const result = req.db.createCharacter(name, userId, collectionId);
          res.redirect(`/character/${result.lastInsertRowid}`);
          break;
      }
    }
    catch(e)
    {
      console.log(e);
      res.render('newEntry', {collectionId: collectionId, entryType: entryType, error: "A " + entryType + " with that name already exists."});
    }
  });





/* Get world page. (Contains links to notes pages) */
router.get('/world', checkAuth, function(req, res) {
  res.render('world', {worldName: "Kingdom of Placeholderia"});
});

/* Get character page */
router.get('/character', checkAuth, function(req, res) {
  res.render('character', {characterName: "Sir Exel Pixelart"});
});

module.exports = router;
