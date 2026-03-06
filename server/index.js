const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./lib/db');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// Run migrations
runMigrations();

// API routes
const api = express.Router();
api.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

api.use('/projects', require('./routes/projects'));
api.use('/', require('./routes/tasks'));
api.use('/', require('./routes/groups'));
api.use('/', require('./routes/dependencies'));
api.use('/', require('./routes/comments'));
api.use('/team', require('./routes/team'));
api.use('/', require('./routes/exports'));
api.use('/', require('./routes/imports'));
api.use('/', require('./routes/search'));

app.use('/api/v1', api);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
