require('dotenv').config();

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const SqlStore = require('better-sqlite3-session-store')(session);
const path = require('path');
const db = require('./bin/db');
const fs = require('fs');

const index = require('./routes/index');

const app = express();

app.locals.APP_NAME = 'The Bard\'s Journal';
const SESSION_MINUTES = 15;

//Ensure the data directory exists

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbFileName = process.env.DB_NAME || 'database.sqlite';
const dbPath = path.join(dataDir, dbFileName);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const databaseManager = db.createDatabaseManager(dbPath);

/* Setup session tracking */
app.use(session(
  {
    store: new SqlStore(
      {
        client: databaseManager.db,
        expired: 
          {
            clear: true,
            intervalMs: 15 * 60 * 1000 /* Clears expired sessions every 15 minutes */
          }
      }
    ),
    secret: process.env.SESSION_SECRET || 'dev-fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie:
      {
        maxAge: 12 * 60 * 60 * 1000, /* Sessions expire after 12 hours of inactivity */
        httpOnly: true, /* prevents JS XSS attacks from stealing the cookie */
        secure: process.env.NODE_ENV === 'production'
      }
  }
));

/* Save the user so it doesn't need to be passed as part of every call */
app.use((req, res, next) =>
  {
    res.locals.user = req.session.user || null;
    next();
  }
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', require('ejs').__express);
app.set('view engine', 'ejs');
app.use(expressLayouts);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Static files in public directory images, css, js, etc.
app.use(express.static(path.join(__dirname, 'public')));

// Static html files in the static directory
// This is for static files that are not using a template engine
app.use(express.static(path.join(__dirname, 'static')));

// Middleware to attach database to request
app.use((request, response, next) => {
  request.db = databaseManager.dbHelpers;
  next();
});
app.use('/', index);


module.exports = app;
