// src/controllers/messageController.js
const { generatePersonalizedMessage } = require('../services/aiService');

// Generate personalized outreach message
const createPersonalizedMessage = async (req, res) => {
  try {
    const profileData = req.body;
    
    // Validate input
    const requiredFields = ['name', 'job_title', 'company', 'location', 'summary'];
    const missingFields = requiredFields.filter(field => !profileData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missingFields 
      });
    }
    
    // Generate message using AI service
    const message = await generatePersonalizedMessage(profileData);
    
    res.status(200).json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Error generating personalized message', error: error.message });
  }
};

module.exports = {
  createPersonalizedMessage
};