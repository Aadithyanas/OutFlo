import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Campaign } from '../types';
import { api } from '../api';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

export const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await api.getCampaigns();
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (campaign: Campaign) => {
    // If already toggling this campaign, prevent duplicate requests
    if (toggling === campaign._id) return;
    
    setToggling(campaign._id!);
    try {
      const newStatus = campaign.status === 'active' ? 'inactive' : 'active';
      await api.updateCampaign(campaign._id!, { status: newStatus });
      
      // Update locally instead of reloading all campaigns
      setCampaigns(prevCampaigns => 
        prevCampaigns.map(c => 
          c._id === campaign._id 
            ? { ...c, status: newStatus } 
            : c
        )
      );
    } catch (error) {
      console.error('Error updating campaign status:', error);
    } finally {
      setToggling(null);
    }
  };

  const deleteCampaign = async (id: string) => {
    // If already deleting this campaign, prevent duplicate requests
    if (deleting === id) return;
    
    setDeleting(id);
    try {
      await api.deleteCampaign(id);
      
      // Update locally instead of reloading
      setCampaigns(prevCampaigns => 
        prevCampaigns.filter(campaign => campaign._id !== id)
      );
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white animate-pulse-text">Campaigns</h1>
        <button
          onClick={() => navigate('/scrapping')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          <Plus size={20} />
          <span>Scrapping</span>
        </button>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          <Plus size={20} />
          <span>New Campaign</span>
        </button>
      </div>

      <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-blue-800/30 pointer-events-none"></div>
        
        <div className="overflow-x-auto scroll relative z-10">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-medium text-blue-300 uppercase tracking-wider bg-gray-800 bg-opacity-50">Name</th>
                <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-medium text-blue-300 uppercase tracking-wider bg-gray-800 bg-opacity-50 hidden md:table-cell">Description</th>
                <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-medium text-blue-300 uppercase tracking-wider bg-gray-800 bg-opacity-50">Status</th>
                <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-medium text-blue-300 uppercase tracking-wider bg-gray-800 bg-opacity-50 hidden sm:table-cell">Leads</th>
                <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-medium text-blue-300 uppercase tracking-wider bg-gray-800 bg-opacity-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-300">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p>Loading campaigns...</p>
                    </div>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-300">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <AlertCircle size={32} className="text-gray-400" />
                      <p>No campaigns found. Create your first campaign!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign, index) => (
                  <tr 
                    key={campaign._id} 
                    className="bg-gray-800 bg-opacity-40 hover:bg-gray-700 hover:bg-opacity-50 transition-all"
                    style={{
                      animation: `fadeInUp 0.5s ease forwards ${index * 0.1}s`,
                      opacity: 0,
                      transform: 'translateY(20px)'
                    }}
                  >
                    <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-white">{campaign.name}</td>
                    <td className="px-4 py-3 md:px-6 md:py-4 text-sm text-gray-300 hidden md:table-cell">
                      {campaign.about && campaign.about.length > 60 
                        ? `${campaign.about.substring(0, 60)}...` 
                        : campaign.about}
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => toggleStatus(campaign)}
                        disabled={toggling === campaign._id}
                        className={`flex items-center space-x-1 rounded-full px-2 py-1 transition-all duration-300 ${
                          campaign.status === 'active' 
                            ? 'text-green-400 bg-green-900 bg-opacity-20 hover:bg-opacity-30' 
                            : 'text-gray-400 bg-gray-700 bg-opacity-30 hover:bg-opacity-40'
                        } ${toggling === campaign._id ? 'animate-pulse' : ''}`}
                      >
                        {toggling === campaign._id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                        ) : campaign.status === 'active' ? (
                          <ToggleRight size={18} className="text-green-400 animate-bounce-once" />
                        ) : (
                          <ToggleLeft size={18} className="text-gray-400 animate-bounce-once" />
                        )}
                        <span className="capitalize text-xs sm:text-sm">
                          {toggling === campaign._id ? 'Updating...' : campaign.status}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                      <span className="bg-blue-900 bg-opacity-30 text-blue-300 px-2 py-1 rounded-full text-xs">
                        {campaign.leads.length} leads
                      </span>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-1 sm:space-x-3">
                        <button
                          onClick={() => navigate(`/campaigns/${campaign._id}`)}
                          className="p-1 sm:p-2 rounded-full bg-blue-900 bg-opacity-20 text-blue-400 hover:bg-opacity-30 transition-all duration-300 hover:scale-110"
                          title="Edit Campaign"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteCampaign(campaign._id!)}
                          disabled={deleting === campaign._id}
                          className={`p-1 sm:p-2 rounded-full bg-red-900 bg-opacity-20 text-red-400 hover:bg-opacity-30 transition-all duration-300 hover:scale-110 ${deleting === campaign._id ? 'opacity-50' : ''}`}
                          title="Delete Campaign"
                        >
                          {deleting === campaign._id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 size={16} className="animate-delete-hover" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style >{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
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
        
        .animate-pulse-text {
          animation: pulse-text 3s infinite ease-in-out;
        }
        
        @keyframes bounce-once {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-in-out;
        }
        
        @keyframes delete-hover {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
          100% { transform: rotate(0deg); }
        }
        
        .animate-delete-hover:hover {
          animation: delete-hover 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};