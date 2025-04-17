const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema({
  profile_url: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  about: String,
  location: String,
  company: String,
  position: String,
  connection_date: String,
  user_email: {
    type: String,
    required: true
  },
  scraped_date: {
    type: Date,
    default: Date.now
  },
  last_updated: Date
});

// Compound index to ensure uniqueness per user
ConnectionSchema.index({ profile_url: 1, user_email: 1 }, { unique: true });

module.exports = mongoose.model('Connection', ConnectionSchema);