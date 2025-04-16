
const mongoose = require('mongoose');

const CampaignStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted'
};

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    about: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.ACTIVE
    },
    leads: { type: [String], default: [] },
    accountIDs: { type: [String], default: [] }
    
  },
  { timestamps: true }
);

const Campaign = mongoose.model('connections', CampaignSchema);

module.exports = {
  Campaign,
  CampaignStatus
};