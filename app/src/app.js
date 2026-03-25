const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const db = require('./bin/db');
const fs = require('fs');

const index = require('./routes/index');

const app = express();

app.locals.APP_NAME = 'The Bard\'s Journal';

//Ensure the data directory exists

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbFileName = process.env.DB_NAME || 'database.sqlite';
const dbPath = path.join(dataDir, dbFileName);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const databaseManager = db.createDatabaseManager(dbPath);

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
