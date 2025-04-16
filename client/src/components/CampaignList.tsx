import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Campaign } from '../types';
import { api } from '../api';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await api.getCampaigns();
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const toggleStatus = async (campaign: Campaign) => {
    try {
      const newStatus = campaign.status === 'active' ? 'inactive' : 'active';
      await api.updateCampaign(campaign._id!, { status: newStatus });
      loadCampaigns();
    } catch (error) {
      console.error('Error updating campaign status:', error);
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await api.deleteCampaign(id);
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          <span>New Campaign</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <tr key={campaign._id}>
               
                <td className="px-6 py-4 whitespace-nowrap">{campaign.name}</td>
                <td className="px-6 py-4">{campaign.about}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(campaign)}
                    className={`flex items-center space-x-1 ${
                      campaign.status === 'active' ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {campaign.status === 'active' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    <span className="capitalize">{campaign.status}</span>
                  </button>
                </td>
                <td className="px-6 py-4">{campaign.leads.length} leads</td>
                <td className="px-6 py-4 space-x-2">
                  <button
                    onClick={() => navigate(`/campaigns/${campaign._id}`)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => deleteCampaign(campaign._id!)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};