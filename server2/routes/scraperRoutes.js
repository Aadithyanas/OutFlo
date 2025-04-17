const express = require('express');
const scraperController = require('../controllers/scraperController');

const router = express.Router();

// Routes
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await scraperController.login(email, password);
  res.json(result);
});

router.post('/connections', async (req, res) => {
  const { email, password, maxConnections } = req.body;
  const result = await scraperController.getConnections(email, password, maxConnections);
  res.json(result);
});

router.post('/detailed-profiles', async (req, res) => {
  const { email, password, urls } = req.body;
  const result = await scraperController.getDetailedProfileData(email, password, urls);
  res.json(result);
});

router.get('/export/:userEmail', async (req, res) => {
  const { userEmail } = req.params;
  const result = await scraperController.exportToJson(userEmail);
  res.json(result);
});

module.exports = router;