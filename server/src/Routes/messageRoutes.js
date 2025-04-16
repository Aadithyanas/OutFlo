// src/routes/messageRoutes.js
const express = require('express');
const messageController = require('../controllers/messageController');

const router = express.Router();

// POST /personalized-message - Generate personalized outreach message
router.post('/', messageController.createPersonalizedMessage);

module.exports = router;