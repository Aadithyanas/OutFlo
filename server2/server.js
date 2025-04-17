const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const scraperRoutes = require('./routes/scraperRoutes');
const { connectDB } = require('./config/db');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/scraper', scraperRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});