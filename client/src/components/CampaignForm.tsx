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
  
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
    <div className="flex justify-center items-center min-h-screen p-6 bg-gray-800">
      <div className="w-full max-w-2xl  relative rounded-lg">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 rounded-lg blur-md opacity-75 animate-pulseanimate-rgb"></div>
        <div className="relative bg-gray-800 bg-opacity-90 rounded-lg backdrop-blur-sm shadow-xl">
          <div className="p-8">
            <h1 className="text-3xl font-bold mb-8 text-white text-center animate-pulse-text">
              {id ? 'Edit Campaign' : 'New Campaign'}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-group">
                <label className={`block text-sm font-medium transition-all duration-300 ${focusedField === 'name' ? 'text-blue-400 transform translate-y-1' : 'text-gray-300'}`}>
                  Name
                </label>
                <input
                  type="text"
                  value={campaign.name}
                  onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  className="mt-1 block w-full py-3 px-4 rounded-md bg-gray-700 border-2 border-gray-600 text-white shadow-inner focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 hover:border-gray-500"
                  required
                />
              </div>

              <div className="form-group">
                <label className={`block text-sm font-medium transition-all duration-300 ${focusedField === 'about' ? 'text-pink-400 transform translate-y-1' : 'text-gray-300'}`}>
                  Description
                </label>
                <textarea
                  value={campaign.about}
                  onChange={(e) => setCampaign({ ...campaign, about: e.target.value })}
                  onFocus={() => setFocusedField('about')}
                  onBlur={() => setFocusedField(null)}
                  className="mt-1 block w-full py-3 px-4 rounded-md bg-gray-700 border-2 border-gray-600 text-white shadow-inner focus:border-pink-500 focus:ring focus:ring-pink-500 focus:ring-opacity-50 transition-all duration-300 hover:border-gray-500"
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label className={`block text-sm font-medium transition-all duration-300 ${focusedField === 'status' ? 'text-purple-400 transform translate-y-1' : 'text-gray-300'}`}>
                  Status
                </label>
                <select
                  value={campaign.status}
                  onChange={(e) => setCampaign({ ...campaign, status: e.target.value as Campaign['status'] })}
                  onFocus={() => setFocusedField('status')}
                  onBlur={() => setFocusedField(null)}
                  className="mt-1 block w-full py-3 px-4 rounded-md bg-gray-700 border-2 border-gray-600 text-white shadow-inner focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 transition-all duration-300 hover:border-gray-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group">
                <label className={`block text-sm font-medium transition-all duration-300 ${focusedField === 'leads' ? 'text-green-400 transform translate-y-1' : 'text-gray-300'}`}>
                  LinkedIn Profile URLs (one per line)
                </label>
                <textarea
                  value={campaign.leads?.join('\n')}
                  onChange={(e) => handleLeadsChange(e.target.value)}
                  onFocus={() => setFocusedField('leads')}
                  onBlur={() => setFocusedField(null)}
                  className="mt-1 block w-full py-3 px-4 rounded-md bg-gray-700 border-2 border-gray-600 text-white shadow-inner focus:border-green-500 focus:ring focus:ring-green-500 focus:ring-opacity-50 transition-all duration-300 hover:border-gray-500"
                  rows={4}
                  placeholder="https://linkedin.com/in/profile-1&#10;https://linkedin.com/in/profile-2"
                />
              </div>

              <div className="form-group">
                <label className={`block text-sm font-medium transition-all duration-300 ${focusedField === 'accountIDs' ? 'text-yellow-400 transform translate-y-1' : 'text-gray-300'}`}>
                  Account IDs (one per line)
                </label>
                <textarea
                  value={campaign.accountIDs?.join('\n')}
                  onChange={(e) => handleAccountIDsChange(e.target.value)}
                  onFocus={() => setFocusedField('accountIDs')}
                  onBlur={() => setFocusedField(null)}
                  className="mt-1 block w-full py-3 px-4 rounded-md bg-gray-700 border-2 border-gray-600 text-white shadow-inner focus:border-yellow-500 focus:ring focus:ring-yellow-500 focus:ring-opacity-50 transition-all duration-300 hover:border-gray-500"
                  rows={4}
                  placeholder="123&#10;456"
                />
              </div>

              <div className="mt-8 flex space-x-4 justify-center">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  {id ? 'Update Campaign' : 'Create Campaign'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="bg-gray-700 text-gray-200 px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style >{`
        @keyframes gradient-slow {
          0%, 100% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
        }
        
        @keyframes rgb-shift {
          0%, 100% {
            filter: hue-rotate(0deg) brightness(1);
          }
          25% {
            filter: hue-rotate(90deg) brightness(1.1);
          }
          50% {
            filter: hue-rotate(180deg) brightness(1);
          }
          75% {
            filter: hue-rotate(270deg) brightness(1.1);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
        
        @keyframes pulse-text {
          0%, 100% {
            text-shadow: 0 0 10px rgba(79, 209, 255, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(79, 209, 255, 0.8);
          }
        }
        
        .animate-gradient-slow {
          animation: gradient-slow 15s ease infinite;
          background-size: 200% 200%;
        }
        
        .animate-rgb {
          animation: rgb-shift 10s infinite linear;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s infinite ease-in-out;
        }
        
        .animate-pulse-text {
          animation: pulse-text 3s infinite ease-in-out;
        }
        
        .form-group {
          transition: all 0.3s ease;
        }
        
        .form-group:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};