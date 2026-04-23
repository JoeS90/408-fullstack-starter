var express = require('express');
var router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const USER_IMAGE_PATH = 'user_uploads/images';


/*============================================================
    MIDDLEWARE
  ============================================================*/

  /* Authentication middleware. Reroute to main on failed authentication */
  function checkAuth(req, res, next)
  {
    if(req.session.user)
    {
      return next();
    }
    else
    {
      const isFetch = req.headers['content-type'] === 'application/json';

      if(isFetch)
      {
        return res.status(401).json({ error: "Session expired. Please return to Home and login."})
      }
      else
      {
        res.redirect('/');
      }
    }
  }

  /* Configure Multer for handling image uploads */
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const userId = req.session.user.id;
      const absPath = path.join(__dirname, '../public', USER_IMAGE_PATH, 'user_' + userId.toString());

      /* If the user doesn't have a folder, make one */
      if(!fs.existsSync(absPath))
      {
        fs.mkdirSync(absPath, {recursive: true});
      }
      cb(null, absPath);
    },
    filename: (req, file, cb) => {
      const newImgId = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, newImgId + extension);
    }
  });

  const upload = multer({ storage: storage});

/*============================================================
    ADMIN ROUTING
  ============================================================*/
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
    const userId = req.session.user.id;
    const collections = req.db.getCollectionsByUser(userId);

    res.render('home', {user: req.session.user.name , collections: collections});
  });

  /* Get about page. */
  router.get('/about', function(req, res) {
    res.render('about');
  });

/*============================================================
    PAGE CREATION/RETRIEVAL/DELETION
  ============================================================*/
  /* COLLECTION */
    router.get('/createCollection', checkAuth, function(req, res) {
      res.render('createCollection', {error: null});
    });

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

    router.delete('/deleteCollection/:id', checkAuth, function(req, res) {
      const collectionId = req.params.id;
      const userId = req.session.user.id;

      try
      {
        const images = req.db.getImagesByCollection(collectionId);
        images.forEach(image => {
          if(image.image_path !== null && image.image_path !== '')
          {
            const absPath = path.join(__dirname, '../public', image.image_path);
            if(fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          }
        });

        const data = req.db.getCollection(collectionId, userId);
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }

        const result = req.db.deleteCollection(collectionId, userId);

        res.status(200).json({success: true});
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e.message});
      }
    });

    router.get('/collection/:id', checkAuth, function(req, res) {
      const collectionId = req.params.id;
      const userId = req.session.user.id;
      try
      {
        const data = req.db.getCollection(collectionId, userId);
        
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }

        const rels = {
          characters: req.db.getEntriesByCollectionByType(collectionId, 'character'),
          locations: req.db.getOrphanLocationsByCollection(collectionId),
          organizations: req.db.getEntriesByCollectionByType(collectionId, 'organization'),
          lores: req.db.getEntriesByCollectionByType(collectionId, 'lore'),
        }

        res.render('world', {world: data, relationships: rels});
      }
      catch(e)
      {
        console.log(e);
        return res.status(500).json({error: e.message});
      }
    });

    router.post('/collection/:collectionId', checkAuth, function(req, res){
      const {collectionId} = req.params;
      res.redirect(`/collection/${collectionId}`);
    });

  /* ENTRY */
    router.post('/createEntry', checkAuth, function(req, res) {
      const {collectionId, entryId, entryType, assocType} = req.body;
      res.render('newEntry', {collectionId: collectionId, entryId: entryId, entryType: entryType, assocType: assocType, error: null});
    });

    router.post('/addEntry', checkAuth, function(req, res) {
      const{collectionId, entryId, entryType, assocType, name} = req.body;
      const relationship = req.body.relationship || null;
      const userId = req.session.user.id;

      try
      {
        const collection = req.db.getCollection(collectionId, userId);
        if(!collection)
        {
          return res.status(404).send("Collection not found.");
        }

        const existing = req.db.getNamesByCollectionAndType(collectionId, assocType);
        if(req.db.nameAlreadyExists(existing, name))
        {
          throw new Error(`A ${assocType} with that name already exists in this collection.`);
          return;
        }

        const resultCreate = req.db.createEntry(name, collectionId, assocType)
        if(entryType !== 'collection')
        {
          const resultAssociate = req.db.createAssociation(collectionId, entryId, entryType, resultCreate.lastInsertRowid, assocType, relationship);
        }
            
        res.redirect(`/${assocType}/${collectionId}/${resultCreate.lastInsertRowid}`);
      }
      catch(e)
      {
        console.log(e);
        res.render('newEntry', {collectionId: collectionId, entryId: entryId, entryType: entryType, assocType: assocType, error: e});
      }
    });

    router.delete('/deleteEntry/:collectionId/:entryId/:entryType', checkAuth, function(req, res) {
      const collectionId = req.params.collectionId;
      const entryType = req.params.entryType;
      const entryId = req.params.entryId;
      const userId = req.session.user.id;

      try
      {
        const data = req.db.getCollection(collectionId, userId);
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }

        const entry = req.db.getEntry(collectionId, entryId, entryType);
        
        const imagePath = entry.image_path;
        
        if(imagePath !== null && imagePath !== '')
        {
          const absPath = path.join(__dirname, '../public', imagePath);
          if(fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
          }
        }

        const result = req.db.deleteEntry(collectionId, entryId, entryType);

        res.status(200).json({success: true});
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e.message});
      }
    });

    router.get('/allEntries/:id', checkAuth, function(req, res) {
      const collectionId = req.params.id;
      const userId = req.session.user.id;

      try
      {
        const data = req.db.getCollection(collectionId, userId);

        if(!data)
        {
          return res.status(404).send("Collection not found.");
        }

        const entries = req.db.getEntriesByCollection(collectionId);

        return res.status(200).json({entries});
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e.message});
      }
    });

    router.get('/:entryType/:collectionId/:id', checkAuth, function(req, res) {
      const entryType = req.params.entryType;
      const collectionId = req.params.collectionId;
      const entryId = req.params.id;
      const userId = req.session.user.id;
      try
      {
        const data = req.db.getCollection(collectionId, userId);
        
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }

        const entry = req.db.getEntry(collectionId, entryId, entryType);

        const rels = {
          characters: req.db.getAssociationsByType(collectionId, entryId, entryType, 'character'),
          locations: req.db.getAssociationsByType(collectionId, entryId, entryType, 'location'),
          organizations: req.db.getAssociationsByType(collectionId, entryId, entryType, 'organization'),
          lores: req.db.getAssociationsByType(collectionId, entryId, entryType, 'lore'),
        }

        res.render(entryType, {entry: entry, relationships: rels});
      }
      catch(e)
      {
        console.log(e);
        return res.status(500).json({error: e.message});
      }
    });

    router.post('/:entryType/:collectionId/:id', checkAuth, function(req, res){
      const {entryType, collectionId, id} = req.params;
      res.redirect(`/${entryType}/${collectionId}/${id}`);
    });

  /* CHARACTER */
    /*router.get('/character/:collectionId/:id', checkAuth, function(req, res) {
      const collectionId = req.params.collectionId;
      const characterId = req.params.id;
      const userId = req.session.user.id;
      try
      {
        const data = req.db.getCollection(collectionId, userId);
        
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }

        const character = req.db.getCharacter(collectionId, characterId);

        const rels = {
          characters: req.db.getAssociationsByType(collectionId, characterId, 'character', 'character'),
          locations: req.db.getAssociationsByType(collectionId, characterId, 'character', 'location')
        }

        res.render('character', {character: character, relationships: rels});
      }
      catch(e)
      {
        console.log(e);
        return res.status(500).json({error: e.message});
      }
    });

    router.post('/character/:collectionId/:id', checkAuth, function(req, res){
      const {collectionId, id} = req.params;
      res.redirect(`/character/${collectionId}/${id}`);
    });

  /* LOCATION */

  /* ORGANIZATION */

  /* LORE */



  /* ASSOCIATION PAGE */
    router.post('/createAssociation', checkAuth, function(req, res) {
      const {collectionId, entryId, entryType, assocType} = req.body;

      try
      {
        const entryName = req.db.getEntry(collectionId, entryId, entryType).name;
        const list = req.db.getEntriesByCollectionByType(collectionId, assocType);

        res.render('connections', {
          collectionId, 
          entryId, 
          entryName, 
          entryType, 
          assocType,
          list,
          error: null
        });
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e});
      }
    });

    router.post('/addAssociation', checkAuth, function(req, res) {
      const {collectionId, entryId, entryType, assocType, assocId, relationship} = req.body;
      const userId = req.session.user.id;

      try
      {
        if(req.db.getCollection(collectionId, userId) === null)
        {
          res.status(404).json({error: "Collection not found."});
          return;              
        }

        // TODO: add loop for multiple entries
        req.db.createAssociation(collectionId, entryId, entryType, assocId, assocType, relationship);

        res.redirect(`/${entryType}/${collectionId}/${entryId}`);
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e});
      }
    });

/*============================================================
    SECTION UPDATES
  ============================================================*/
  /* TITLE */
    router.post('/updateTitle', checkAuth, function(req, res) {
      const { collectionId, entryId, entryType, newTitle } = req.body;
      const userId = req.session.user.id;

      try
      {
        if(req.db.getCollection(collectionId, userId) === null)
        {
          res.status(404).json({error: "Collection not found."});
          return;              
        }

        if(entryType === 'collection')
        {
          const collections = req.db.getCollectionsByUser(userId);
          if(req.db.nameAlreadyExists(collections, newTitle))
          {
            res.status(409).json({error: "That name is already in use."})
            return;
          }
          req.db.modifyCollectionName(collectionId, userId, newTitle);
        }
        else
        {
          const names = req.db.getNamesByCollectionAndType(collectionId, entryType);
          if(req.db.nameAlreadyExists(names, newTitle))
          {
            res.status(409).json({error: "That name is already in use."})
            return;
          }
          req.db.modifyEntryName(collectionId, entryId, entryType, newTitle);
        }

        res.status(200).json({ success: true });
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e});
      }
    });
  
  /* NOTE AREA */
    router.post('/updateText', checkAuth, function(req, res) {
      const { collectionId, entryId, entryType, field, newText } = req.body;
      const userId = req.session.user.id;

      try
      {
        if(req.db.getCollection(collectionId, userId) === null)
        {
          res.status(404).json({error: "Collection not found."});
          return;              
        }

        if(entryType === 'collection')
        {
          const collections = req.db.getCollectionsByUser(userId);
          if(req.db.nameAlreadyExists(collections, newText))
          {
            res.status(409).json({error: "That name is already in use."})
            return;
          }
          req.db.modifyCollectionText(collectionId, userId, field, newText);
        }
        else
        {
          const names = req.db.getNamesByCollectionAndType(collectionId, entryType);
          if(req.db.nameAlreadyExists(names, newText))
          {
            res.status(409).json({error: "That name is already in use."})
            return;
          }
          req.db.modifyEntryText(collectionId, entryId, entryType, field, newText);
        }
        
        res.status(200).json({ success: true });
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e});
      }
    });

  /* IMAGE AREA */
    /* upload.single is a built-in multer function. The argument needs to match the file
       name in the request body. */
    router.post('/updateImage', checkAuth, upload.single('image'), function(req, res) {
      if(!req.file) {
        return res.status(400).json({error: "No image file provided."});
      }
      
      const { collectionId, entryId, entryType } = req.body;
      const userId = req.session.user.id;

      try
      {
        const collection = req.db.getCollection(collectionId, userId);

        if(collection === null)
        {
          res.status(404).json({error: "Collection not found."});
          fs.unlinkSync(req.file.path);
          return;              
        }

        let oldPath = '';
        const newPath = `/${USER_IMAGE_PATH}/user_${userId}/${req.file.filename}`;

        if(entryType === 'collection')
        {
          oldPath = collection.image_path;
          req.db.modifyCollectionImage(collectionId, userId, newPath);
        }
        else
        {
          oldPath = req.db.getEntryImage(collectionId, entryId, entryType).image_path;
          req.db.modifyEntryImage(collectionId, entryId, entryType, newPath);
        }

        /* Delete the old image if there is one. */
        if(oldPath && oldPath !== '')
        {
          /* Create a system-agnostic absolute path. (Works on dev environment and server.) */
          const absPath = path.join(__dirname, '../public', oldPath);
          /* Delete the existing file. */
          if(fs.existsSync(absPath))
          {
            fs.unlinkSync(absPath);
          }
        }
        
        res.status(200).json({ success: true, imagePath: newPath });
      }
      catch(e)
      {
        console.log(e);
        if (req.file) {fs.unlinkSync(req.file.path);}
        res.status(500).json({error: e});
      }
    });

    router.delete('/deleteImage/:collectionId/:entryId/:entryType', checkAuth, function(req, res) {
      const { collectionId, entryId, entryType } = req.params;
      const userId = req.session.user.id;

      try
      {
        const collection = req.db.getCollection(collectionId, userId);
        if(!collection)
        {
          return res.status(404).json({error: "Collection not found."});
        }        

        var imagePath;

        if(entryType === 'collection')
        {
          imagePath = collection.image_path;

          req.db.removeCollectionImage(collectionId);
        }
        else
        {
          const entry = req.db.getEntry(collectionId, entryId, entryType);
        
          imagePath = entry.image_path;

          req.db.removeEntryImage(collectionId, entryId, entryType);
        }
        
        
        if(imagePath !== null && imagePath !== '')
        {
          const absPath = path.join(__dirname, '../public', imagePath);
          if(fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
          }
        }

        res.status(200).json({success: true});
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e.message});
      }
    });

  /* ASSOCIATION AREA */
    router.delete('/deleteAssociation/:collectionId/:entryId/:entryType/:assocId/:assocType/:relationship', checkAuth, function(req, res) {
      const collectionId = req.params.collectionId;
      const entryId = req.params.entryId;
      const entryType = req.params.entryType;
      const assocId = req.params.assocId;
      const assocType = req.params.assocType;
      const relationship = req.params.relationship === "null" ? null : req.params.relationship;
      const userId = req.session.user.id;

      try
      {
        const data = req.db.getCollection(collectionId, userId);
        if(!data)
        {
          return res.status(404).json({error: "Collection not found."});
        }        

        const result = req.db.removeAssociation(collectionId, entryId, entryType, assocId, assocType, relationship);

        res.status(200).json({success: true});
      }
      catch(e)
      {
        console.log(e);
        res.status(500).json({error: e.message});
      }
    });

module.exports = router;
