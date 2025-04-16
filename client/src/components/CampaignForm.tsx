import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Campaign } from '../types';
import { api } from '../api';

export const CampaignForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Partial<Campaign>>({
    name: '',
    about: '',
    status: 'active',
    leads: [],
    accountIDs: [],
  });

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  const loadCampaign = async () => {
    try {
      const response = await api.getCampaign(id!);
      setCampaign(response.data);
    } catch (error) {
      console.error('Error loading campaign:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (id) {
        await api.updateCampaign(id, campaign);
      } else {
        await api.createCampaign(campaign as Campaign);
      }
      navigate('/');
    } catch (error) {
      console.error('Error saving campaign:', error);
    }
  };

  const handleLeadsChange = (value: string) => {
    setCampaign({
      ...campaign,
      leads: value.split('\n').filter(lead => lead.trim()),
    });
  };

  const handleAccountIDsChange = (value: string) => {
    setCampaign({
      ...campaign,
      accountIDs: value.split('\n').filter(id => id.trim()),
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {id ? 'Edit Campaign' : 'New Campaign'}
      </h1>

      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={campaign.about}
              onChange={(e) => setCampaign({ ...campaign, about: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={campaign.status}
              onChange={(e) => setCampaign({ ...campaign, status: e.target.value as Campaign['status'] })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              LinkedIn Profile URLs (one per line)
            </label>
            <textarea
              value={campaign.leads?.join('\n')}
              onChange={(e) => handleLeadsChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={4}
              placeholder="https://linkedin.com/in/profile-1&#10;https://linkedin.com/in/profile-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Account IDs (one per line)
            </label>
            <textarea
              value={campaign.accountIDs?.join('\n')}
              onChange={(e) => handleAccountIDsChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={4}
              placeholder="123&#10;456"
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {id ? 'Update Campaign' : 'Create Campaign'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};