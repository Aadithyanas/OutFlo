export interface Campaign {
  _id?: string;
  
  name: string;
  about: string;
  status: 'active' | 'inactive' | 'deleted';
  leads: string[];
  accountIDs: string[];
}

export interface LinkedInProfile {
  name: string;
  job_title: string;
  company: string;
  location: string;
  summary: string;
}

export interface PersonalizedMessage {
  message: string;
}