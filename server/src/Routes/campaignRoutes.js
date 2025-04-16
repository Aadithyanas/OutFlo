// src/routes/campaignRoutes.js
const express = require('express');
const campaignController = require('../controllers/campaignController');

const router = express.Router();

// GET /campaigns - Fetch all campaigns (excluding DELETED)
router.get('/', campaignController.getAllCampaigns);

// GET /campaigns/:id - Fetch a single campaign by ID
router.get('/:id', campaignController.getCampaignById);

// POST /campaigns - Create a new campaign
router.post('/', campaignController.createCampaign);

// PUT /campaigns/:id - Update campaign details
router.put('/:id', campaignController.updateCampaign);

// DELETE /campaigns/:id - Soft delete (set status to DELETED)
router.delete('/:id', campaignController.deleteCampaign);

module.exports = router;