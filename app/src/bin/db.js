const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

/* Create the users table. Tracks accounts. */
/* TODO: Implement UUID and encrypted storage of emails */
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email TEXT,
    email_encrypted TEXT,
    email_iv TEXT,
    pwd_hash TEXT,
    created_at INTEGER,
    last_login INTEGER
  )`

/* Create the collections (worlds) table. */
const createCollectionsTable = `
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    creator_id INTEGER,
    image_path TEXT,
    description TEXT,
    notes TEXT,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE 
  )`

/* Create the locations table. */
const createLocationsTable = `
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER,
    image_path TEXT,
    atmosphere TEXT,
    history TEXT,
    notes TEXT,
    parent_location_id INTEGER,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_location_id) REFERENCES locations(id) ON DELETE SET NULL
  )`

/* Create the characters table. */
const createCharactersTable = `
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER,
    image_path TEXT,
    description TEXT,
    behavior TEXT,
    backstory TEXT,
    notes TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  )`

/* Create the Database */
function createDatabaseManager(dbPath) {
  /* Initial setup */
  const database = new Database(dbPath);
  console.log('Database manager created for:', dbPath);
  database.pragma('foreign_keys = ON');

  /* Build tables */
  database.exec(createUsersTable);
  database.exec(createCollectionsTable);
  database.exec(createLocationsTable);
  database.exec(createCharactersTable);

  function ensureConnected() {
    if (!database.open) {
      throw new Error('Database connection is not open');
    }
  }

  return {
    db: database,
    dbHelpers: 
    {
      /* USERS */
      createUser: (username, email, password) => 
      {
        const pwd_hash = bcrypt.hashSync(password, 10);

        try
        {
          const stmt = database.prepare(`
            INSERT INTO users (username, email, pwd_hash, created_at)
            VALUES (?, ?, ?, ?)
          `);

          const newUserId = stmt.run(username, email, pwd_hash, Date.now()).lastInsertRowid;
          return newUserId;
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getUser: (username) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT * 
            FROM users 
            WHERE username = ?
          `)

          const row = stmt.get(username);
          return row ? row : null;
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      verifyUser: function(username, password)
      {
        const user = this.getUser(username);

        if(!user)
        {
          throw new Error("Invalid username.");
        }

        if(!bcrypt.compareSync(password, user.pwd_hash))
        {
          throw new Error("Invalid password.");
        }

        return user.id;
      },

      /* COLLECTIONS */
      createCollection: (name, userId) =>
      {
        try
        {
          const stmt = database.prepare(`
            INSERT INTO collections (name, creator_id, image_path, description, notes)
            VALUES (?, ?, ?, ?, ?)  
          `);

          return stmt.run(name, userId, '', '', '');
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      deleteCollection: (collectionId, userId) =>
      {
        try
        {
          const stmt = database.prepare(`
            DELETE FROM collections
            WHERE id = ?
              AND creator_id = ?
          `);

          return stmt.run(collectionId, userId);
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getCollection: (collectionId, userId) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT * 
            FROM collections 
            WHERE id = ?
              AND creator_id = ?
          `);

          const row = stmt.get(collectionId, userId);
          return row ? row : null;
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getCollectionsByUser: (userId) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT id, name
            FROM collections
            WHERE creator_id = ?
          `)

          const response = stmt.all(userId);
          return response ? response : null;
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyCollectionName: (collectionId, userId, newName) =>
      {
        try
        {
          const stmt = database.prepare(`
            UPDATE collections
            SET name = ?
            WHERE id = ?
              AND creator_id = ?
          `);

          return stmt.run(newName, collectionId, userId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyCollectionText: (collectionId, userId, field, newText) =>
      {
        const fields = ['description', 'notes'];
        if(!fields.includes(field))
        {
          throw new Error("Invalid field.");
        }

        try
        {
          const stmt = database.prepare(`
            UPDATE collections
            SET ${field} = ?
            WHERE id = ?
              AND creator_id = ?
          `);

          return stmt.run(newText, collectionId, userId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyCollectionImage: (collectionId, userId, newPath) =>
      {
        try
        {
          const stmt = database.prepare(`
            UPDATE collections
            SET image_path = ?
            WHERE id = ?
              AND creator_id = ?
          `);

          return stmt.run(newPath, collectionId, userId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getEntriesByCollection(collectionId)
      {
        try
        {
          // TODO: Keep this up to date
          const stmt = database.prepare(`
              SELECT id, name, 'character' as type
              FROM characters
              WHERE collection_id = :cid
            UNION ALL
              SELECT id, name, 'location' as type
              FROM locations
              WHERE collection_id = :cid
          `);

          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getImagesByCollection(collectionId)
      {
        try
        {
          // TODO: Keep this up to date
          const stmt = database.prepare(`
              SELECT image_path
              FROM collections
              WHERE id = :cid
            UNION ALL
              SELECT image_path
              FROM characters
              WHERE collection_id = :cid
            UNION ALL
              SELECT image_path
              FROM locations
              WHERE collection_id = :cid
          `);
          
          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      /* CHARACTERS */
      createCharacter: (name, collectionId) =>
      {
        try
        {
          const stmt = database.prepare(`
            INSERT INTO characters (name, collection_id, description, notes)
            VALUES (?, ?, ?, ?)  
          `);

          return stmt.run(name, userId, '', '');
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      nameAlreadyExists: (array, name) =>
      {
        for(var i = 0; i < array.length; i++)
        {
          if(array[i].name.toLowerCase() === name.toLowerCase())
          {
            return true;
          }
        }
        return false;
      },

    }
  };
}


module.exports = {
  createDatabaseManager,
};
