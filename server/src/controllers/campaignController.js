// src/controllers/campaignController.js
const { Campaign, CampaignStatus } = require('../Models/Campaign');

// Get all campaigns (excluding deleted)
const getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ status: { $ne: CampaignStatus.DELETED } });
    res.status(200).json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaigns', error: error.message });
  }
};

// Get campaign by ID
const getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.status === CampaignStatus.DELETED) {
      return res.status(404).json({ message: 'Campaign not found or has been deleted' });
    }
    
    res.status(200).json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaign', error: error.message });
  }
};

// Create new campaign
const createCampaign = async (req, res) => {
  try {
    const campaignData = req.body;
    const campaign = new Campaign(campaignData);
    const savedCampaign = await campaign.save();
    console.log(savedCampaign)
    res.status(201).json(savedCampaign);
  } catch (error) {
    console.log(error.message)
    res.status(400).json({ message: 'Error creating campaign', error: error.message });
  }
};

// Update campaign
const updateCampaign = async (req, res) => {
  try {
    const campaignData = req.body;
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      campaignData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.status(200).json(updatedCampaign);
  } catch (error) {
    res.status(400).json({ message: 'Error updating campaign', error: error.message });
  }
};

// Soft delete campaign (set status to DELETED)
const deleteCampaign = async (req, res) => {
  try {
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { status: CampaignStatus.DELETED },
      { new: true }
    );
    
    if (!updatedCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.status(200).json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting campaign', error: error.message });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign
};