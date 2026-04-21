const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

/* Create the users table. Tracks accounts. */
/* TODO: Implement UUID and encrypted storage of emails */
/* NOTE: All Entry tables need explicit 'id', 'collection_id', 'name', and 'image_path' fields. */
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
  )`;

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
  )`;

/* Create the characters table. */
const createCharactersTable = `
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER NOT NULL,
    image_path TEXT,
    description TEXT,
    behavior TEXT,
    backstory TEXT,
    notes TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  )`;

  const createCharacterAssocCascadeTrigger = `
    CREATE TRIGGER IF NOT EXISTS delete_character_associations
      AFTER DELETE ON characters
      BEGIN
        DELETE FROM associations
        WHERE collection_id = OLD.collection_id
          AND (
              (entry_id = OLD.id AND entry_type = 'character')
            OR  
              (assoc_id = OLD.id AND assoc_type = 'character')
          );
      END;
    `;

/* Create the locations table. */
const createLocationsTable = `
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER NOT NULL,
    image_path TEXT,
    atmosphere TEXT,
    history TEXT,
    notes TEXT,
    parent_location_id INTEGER,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_location_id) REFERENCES locations(id) ON DELETE SET NULL
  )`;

  const createLocationsAssocCascadeTrigger = `
    CREATE TRIGGER IF NOT EXISTS delete_location_associations
      AFTER DELETE ON locations
      BEGIN
        DELETE FROM associations
        WHERE collection_id = OLD.collection_id
          AND (
              (entry_id = OLD.id AND entry_type = 'location')
            OR  
              (assoc_id = OLD.id AND assoc_type = 'location')
          );
      END;
    `;

/* Create the organizations table. */
const createOrganizationsTable = `
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER NOT NULL,
    image_path TEXT,
    overview TEXT,
    history TEXT,
    hierarchy TEXT,
    notes TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  )`;

  const createOrganizationsAssocCascadeTrigger = `
    CREATE TRIGGER IF NOT EXISTS delete_organization_associations
      AFTER DELETE ON organizations
      BEGIN
        DELETE FROM associations
        WHERE collection_id = OLD.collection_id
          AND (
              (entry_id = OLD.id AND entry_type = 'organization')
            OR  
              (assoc_id = OLD.id AND assoc_type = 'organization')
          );
      END;
    `;

/* Create the lore table. (I know it shouldn't be 'lores'. Don't get me started. */
const createLoresTable = `
  CREATE TABLE IF NOT EXISTS lores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    collection_id INTEGER NOT NULL,
    image_path TEXT,
    summary TEXT,
    details TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  )`;

  const createLoresAssocCascadeTrigger = `
    CREATE TRIGGER IF NOT EXISTS delete_lore_associations
      AFTER DELETE ON lores
      BEGIN
        DELETE FROM associations
        WHERE collection_id = OLD.collection_id
          AND (
              (entry_id = OLD.id AND entry_type = 'lore')
            OR  
              (assoc_id = OLD.id AND assoc_type = 'lore')
          );
      END;
    `;

/* Create the associations table */
const createAssociationsTable = `
  CREATE TABLE IF NOT EXISTS associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    entry_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL,
    assoc_id INTEGER NOT NULL,
    assoc_type TEXT NOT NULL,
    relationship TEXT
  )`;

  const createAssocsIndexPrimary = `
    CREATE INDEX IF NOT EXISTS idx_assoc_primary
      ON associations (collection_id, entry_id, entry_type)
    `;

  const createAssocsIndexRelations = `
    CREATE INDEX IF NOT EXISTS idx_assoc_relations
      ON associations (collection_id, assoc_id, assoc_type)
    `;

/* Create the Database */
function createDatabaseManager(dbPath) {
  /* Initial setup */
  const database = new Database(dbPath);
  console.log('Database manager created for:', dbPath);
  database.pragma('foreign_keys = ON');

  /* Build tables */
  database.exec(createUsersTable);
  database.exec(createCollectionsTable);
  database.exec(createCharactersTable);
  database.exec(createLocationsTable);
  database.exec(createOrganizationsTable);
  database.exec(createLoresTable);
  database.exec(createAssociationsTable);

  /* Build indexes */
  database.exec(createAssocsIndexPrimary);
  database.exec(createAssocsIndexRelations);

  /* Build triggers */
  database.exec(createCharacterAssocCascadeTrigger);
  database.exec(createLocationsAssocCascadeTrigger);
  database.exec(createOrganizationsAssocCascadeTrigger);
  database.exec(createLoresAssocCascadeTrigger);

  function ensureConnected() {
    if (!database.open) {
      throw new Error('Database connection is not open');
    }
  }

  /* Security functions */
  function validateTable(table)
  {
    // TODO: Keep this up to date. 'Entry' tables ONLY!
    const whitelist = {
      'collection': 'collections',
      'character': 'characters',
      'location': 'locations',
      'organization': 'organizations',
      'lore': 'lores'
    };

    if(!whitelist[table])
    {
      throw new Error(`Invalid table '${table}'.`)
      return null;
    }

    return whitelist[table];
  }

  function validateField(table, field)
  {
    const vTable = validateTable(table);

    const stmt = database.prepare(`PRAGMA table_info(${vTable})`);
    const data = stmt.all();

    const whitelist = data.map(col => col.name);

    if(!whitelist.includes(field))
    {
      throw new Error(`Invalid field '${field}' for table '${table}'.`)
      return null;
    }

    return field;
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

      verifyUser(username, password) /* Do NOT make this an arrow function or 'this' will not work */
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

      getEntriesByCollection: (collectionId) =>
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
            UNION ALL
              SELECT id, name, 'organization' as type
              FROM organizations
              WHERE collection_id = :cid
            UNION ALL
              SELECT id, name, 'lore' as type
              FROM lores
              WHERE collection_id = :cid
          `);

          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getEntriesByCollectionByType: (collectionId, entryType) =>
      {
        const vtable = validateTable(entryType);

        try
        {
          const stmt = database.prepare(`
            SELECT id, name, image_path FROM ${vtable}
            WHERE collection_id = ?
          `);

          return stmt.all(collectionId);
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getImagesByCollection: (collectionId) =>
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
            UNION ALL
              SELECT image_path
              FROM organizations
              WHERE collection_id = :cid
            UNION ALL
              SELECT image_path
              FROM lores
              WHERE collection_id = :cid
          `);
          
          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getCharactersByCollection: (collectionId) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT * FROM characters
            WHERE collection_id = :cid
          `);

          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getOrphanLocationsByCollection: (collectionId) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT * FROM locations
            WHERE collection_id = :cid
              AND parent_location_id IS NULL
          `);

          return stmt.all({cid: collectionId});
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getNamesByCollectionAndType: (collectionId, entryType) =>
      {
        const vtable = validateTable(entryType);

        try
        {
          const stmt = database.prepare(`
            SELECT name FROM ${vtable}
            WHERE collection_id = ?
          `);

          return stmt.all(collectionId);
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

          return stmt.run(name, collectionId, '', '');
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getCharacter: (collectionId, characterId) =>
      {
        try
        {
          const stmt = database.prepare(`
            SELECT * from characters
            WHERE collection_id = ?
              AND id = ?
          `);

          const row = stmt.get(collectionId, characterId);
          return row ? row : null;
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      /* LOCATIONS */

      /* ORGANIZATIONS */

      /* LORE */

      /* GENERIC ENTRY */
      createEntry: (name, collectionId, entryType) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            INSERT INTO ${vtable} (name, collection_id)
            VALUES (?, ?)  
          `);

          return stmt.run(name, collectionId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getEntry: (collectionId, entryId, entryType) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            SELECT * FROM ${vtable}
            WHERE collection_id = ?
              AND id = ?
          `);

          return stmt.get(collectionId, entryId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      deleteEntry: (collectionId, entryId, entryType) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            DELETE FROM ${vtable}
            WHERE collection_id = ?
              AND id = ?
          `);

          return stmt.run(collectionId, entryId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyEntryName: (collectionId, entryId, entryType, newName) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            UPDATE ${vtable}
            SET name = ?
            WHERE id = ?
              AND collection_id = ?
          `);

          return stmt.run(newName, entryId, collectionId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyEntryText: (collectionId, entryId, entryType, field, newText) =>
      {
        const vtable = validateTable(entryType);
        const vfield = validateField(entryType, field);

        try
        {
          const stmt = database.prepare(`
            UPDATE ${vtable}
            SET ${vfield} = ?
            WHERE id = ?
              AND collection_id = ?
          `);

          return stmt.run(newText, entryId, collectionId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      getEntryImage: (collectionId, entryId, entryType) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            SELECT image_path FROM ${vtable}
            WHERE collection_id = ?
              AND id = ?
          `);

          return stmt.get(collectionId, entryId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      modifyEntryImage: (collectionId, entryId, entryType, newPath) =>
      {
        const vtable = validateTable(entryType);
        try
        {
          const stmt = database.prepare(`
            UPDATE ${vtable}
            SET image_path = ?
            WHERE id = ?
              AND collection_id = ?
          `);

          return stmt.run(newPath, entryId, collectionId);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      removeAssociation: (collectionId, entryId, entryType, assocId, assocType, relationship) =>
      {
        try
        {
          const stmt = database.prepare (`
            DELETE FROM associations
            WHERE collection_id = ?
              AND entry_id = ?
              AND entry_type = ?
              AND assoc_id = ?
              AND assoc_type = ?
              AND relationship = ?
          `);

          return stmt.run(collectionId, entryId, entryType, assocId, assocType, relationship);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },
      
      /* GENERAL */
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

      getAssociationsByType(collectionId, entryId, entryType, assocType)
      {
        try
        {
          // TODO: This query does not take into account assymetric relationships (parent-child, employer/employee)
          const getAssocs = database.prepare(`
            SELECT assoc_id AS id, relationship FROM associations
            WHERE collection_id = :cid
              AND entry_id = :eid 
              AND entry_type = :etype
              AND assoc_type = :atype
            UNION
            SELECT entry_id AS id, relationship FROM associations
            WHERE collection_id = :cid
              AND assoc_id = :eid 
              AND assoc_type = :etype
              AND entry_type = :atype
          `);

          const assocIds = getAssocs.all({cid: collectionId, eid: entryId, etype: entryType, atype: assocType});
          const vtable = validateTable(assocType);

          const getEntry = database.prepare(`
            SELECT * FROM ${vtable}
            WHERE id = :eid
          `);
          
          const entries = assocIds.map(assoc => {
            const entry = getEntry.get({eid: assoc.id})
            return {...entry, relationship: assoc.relationship};
          });

          return entries;
        }
        catch(e)
        {
          throw e; // TODO: add specific handling
        }
      },

      createAssociation: (collectionId, entryId, entryType, assocId, assocType, relationship) =>
      {
        if(entryType === 'collection' || assocType === 'collection')
        {
          throw new Error("Associations cannot exist between collections.")
          return;
        }

        try
        {
          const stmt = database.prepare(`
            INSERT INTO associations (collection_id, entry_id, entry_type, assoc_id, assoc_type, relationship)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          return stmt.run(collectionId, entryId, entryType, assocId, assocType, relationship);
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

    }
  };
}


module.exports = {
  createDatabaseManager,
};
