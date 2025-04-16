import axios from 'axios';
import { Campaign, LinkedInProfile, PersonalizedMessage } from './types';

const API_BASE_URL = 'http://localhost:3000'; // Update with your backend URL

export const api = {
  // Campaign APIs
  getCampaigns: () => axios.get<Campaign[]>(`${API_BASE_URL}/campaigns`),
  getCampaign: (id: string) => axios.get<Campaign>(`${API_BASE_URL}/campaigns/${id}`),
  createCampaign: (campaign: Omit<Campaign, '_id'>) => 
    axios.post<Campaign>(`${API_BASE_URL}/campaigns`, campaign),
  updateCampaign: (id: string, campaign: Partial<Campaign>) =>
    axios.put<Campaign>(`${API_BASE_URL}/campaigns/${id}`, campaign),
  deleteCampaign: (id: string) =>
    axios.delete(`${API_BASE_URL}/campaigns/${id}`),
    
  // LinkedIn Message API
  generateMessage: (profile: LinkedInProfile) =>
    axios.post<PersonalizedMessage>(`${API_BASE_URL}/personalized-message`, profile),
};