const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

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
    dbHelpers: {

      createUser: (username, email, password) => 
      {
        const pwd_hash = bcrypt.hashSync(password, 10);

        try
        {
          const stmt = dbPath.prepare(`
            INSERT INTO users (username, email, pwd_hash, created_at)
            VALUES (?, ?, ?, ?)
          `);
          return stmt.run(username, email, pwd_hash, Date.now());
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
          const stmt = dbPath.prepare(`
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

      createCollection: (name, userId) =>
      {
        try
        {
          const stmt = dbPath.prepare(`
            INSERT INTO collections (name, creator_id, description, notes)
            VALUES (?, ?, ?, ?)  
          `);

          return stmt.run(name, userId, '', '');
        }
        catch (e)
        {
          throw e; // TODO: add specific handling
        }
      },

      /* OLD DATA. TODO: Delete these
      clearDatabase: () => {
        if (process.env.NODE_ENV === 'test') {
          ensureConnected();
          database.prepare('DELETE FROM todos').run();
        } else {
          console.warn('clearDatabase called outside of test environment. FIXME!');
        }
      },

      seedTestData: () => {
        if (process.env.NODE_ENV === 'test') {
          ensureConnected();
          const insert = database.prepare('INSERT INTO todos (task, completed) VALUES (?, ?)');
          const testData = [
            { task: 'Test task 1', completed: 0 },
            { task: 'Test task 2', completed: 1 },
            { task: 'Test task 3', completed: 0 },
          ];
          const insertMany = database.transaction((todos) => {
            for (const todo of todos) insert.run(todo.task, todo.completed);
          });
          insertMany(testData);
          console.log('Seeding test data into database');
        } else {
          console.warn('seedTestData called outside of test environment. FIXME!');

        }
      },

      getAllTodos: () => {
        return database.prepare('SELECT * FROM todos ORDER BY id DESC').all();
      },

      getTodoById: (id) => {
        return database.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      },

      createTodo: (task) => {
        const info = database.prepare('INSERT INTO todos (task) VALUES (?)').run(task);
        return info.lastInsertRowid;
      },

      updateTodo: (id, task, completed) => {
        const info = database.prepare('UPDATE todos SET task = ?, completed = ? WHERE id = ?')
          .run(task, completed ? 1 : 0, id);
        return info.changes;
      },

      deleteTodo: (id) => {
        const info = database.prepare('DELETE FROM todos WHERE id = ?').run(id);
        return info.changes;
      },

      toggleTodo: (id) => {
        const info = database.prepare('UPDATE todos SET completed = NOT completed WHERE id = ?').run(id);
        return info.changes;
      },
      getTotalTodos: () => {
        return database.prepare('SELECT COUNT(*) AS c FROM todos').get().c;
      },

      getCompletedTodos: () => {
        return database.prepare('SELECT COUNT(*) AS c FROM todos WHERE completed > 0').get().c;
      },*/
    }
  };
}


module.exports = {
  createDatabaseManager,
};
