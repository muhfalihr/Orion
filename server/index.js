require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./logger');
const { POLLING_INTERVAL } = require('./config');
const { checkTags } = require('./services/builder.service');
const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Static files
app.use('/builds', express.static(path.join(__dirname, '../builds')));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback for SPA (Catch-all middleware)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Polling
setInterval(checkTags, POLLING_INTERVAL);
checkTags();

app.listen(port, '0.0.0.0', () => {
  logger.info({ url: `http://0.0.0.0:${port}` }, 'Package Builder Backend active');
});
