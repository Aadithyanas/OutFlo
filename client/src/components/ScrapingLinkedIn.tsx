// LinkedInScraper.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Connection {
  profile_url: string;
  name: string;
  about: string;
  location?: string;
  company?: string;
  position?: string;
  connection_date?: string;
  scraped_date: string;
}

interface ScraperForm {
  email: string;
  password: string;
  maxConnections: number;
}

interface ApiResponse {
    success: boolean;
    message: string;
    data?: any;  // Changed from 'connections' to 'data' to match your backend
  }

const ScrapingLinkedIn: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<ScraperForm>({
    email: '',
    password: '',
    maxConnections: 100
  });

  // App state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'scrape' | 'results' | 'export'>('scrape');

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'maxConnections' ? parseInt(value) || 0 : value
    });
  };

  // Handle form submission
 // Update the handleSubmit function
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
  
    try {
      const response = await axios.post<ApiResponse>('https://outflo-1.onrender.com/api/scraper/connections', {
        email: formData.email,
        password: formData.password,
        maxConnections: formData.maxConnections || null
      });
  
      if (response.data.success) {
        setSuccess("Successfully scraped connections!");
        if (response.data.data) { // Changed from response.data.connections to response.data.data
          setConnections(response.data.data);
          setActiveTab('results');
        }
      } else {
        setError(response.data.message || 'An error occurred while scraping');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update the handleExport function
  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
  
    try {
      const response = await axios.get<ApiResponse>(
        `https://outflo-1.onrender.com/api/scraper/export/${formData.email}`
      );
  
      if (response.data.success) {
        setSuccess("Export successful!");
        // Create and download JSON file
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `linkedin_connections_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setError(response.data.message || 'An error occurred while exporting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a new function for getting detailed data if needed
  const getDetailedData = async (urls: string[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post<ApiResponse>('https://outflo-1.onrender.com/scraper/detailed-profiles', {
        email: formData.email,
        password: formData.password,
        urls: urls
      });
  
      if (response.data.success) {
        setSuccess("Detailed data fetched successfully!");
        if (response.data.data) {
          // Update your connections state with the detailed data
          setConnections(prev => prev.map(conn => {
            const detailed = response.data.data.find((d: any) => d.profile_url === conn.profile_url);
            return detailed ? {...conn, ...detailed} : conn;
          }));
        }
      } else {
        setError(response.data.message || 'Error fetching detailed data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-16 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-8 text-blue-600">LinkedIn Connection Scraper</h1>
      
      {/* Tabs */}
      <div className="flex mb-6 border-b">
        <button 
          onClick={() => setActiveTab('scrape')} 
          className={`px-4 py-2 ${activeTab === 'scrape' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
        >
          Scrape Connections
        </button>
        <button 
          onClick={() => setActiveTab('results')} 
          className={`px-4 py-2 ${activeTab === 'results' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
          disabled={connections.length === 0}
        >
          Results ({connections.length})
        </button>
        <button 
          onClick={() => setActiveTab('export')} 
          className={`px-4 py-2 ${activeTab === 'export' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
        >
          Export
        </button>
      </div>
      
      {/* Alerts */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
          <p className="font-bold">Success</p>
          <p>{success}</p>
        </div>
      )}
      
      {/* Scrape Form Tab */}
      {activeTab === 'scrape' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                LinkedIn Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="your.email@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                LinkedIn Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 py-2 text-sm text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="maxConnections" className="block text-sm font-medium text-gray-700">
                Max Connections to Scrape (0 for all)
              </label>
              <input
                type="number"
                id="maxConnections"
                name="maxConnections"
                value={formData.maxConnections}
                onChange={handleChange}
                min="0"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 text-white font-medium rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Scraping...' : 'Start Scraping'}
            </button>
          </div>
          
          <div className="text-sm text-gray-500 mt-4">
            <p>Note: This tool uses your LinkedIn credentials to log in and scrape your connections. Your credentials are never stored.</p>
          </div>
        </form>
      )}
      
      {/* Results Tab */}
      {activeTab === 'results' && (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title/About</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connections.map((connection, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{connection.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{connection.about}</td>
                    <td className="px-4 py-3 text-sm">
                      <a 
                        href={connection.profile_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Profile
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {connections.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">No connections have been scraped yet.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="py-6">
          <p className="mb-6 text-gray-700">
            Export all your scraped LinkedIn connections as a JSON file. This file will contain all the information that has been collected from your connections.
          </p>
          
          <div className="mb-4">
            <label htmlFor="exportEmail" className="block text-sm font-medium text-gray-700">
              Email used for scraping
            </label>
            <input
              type="email"
              id="exportEmail"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="your.email@example.com"
            />
          </div>
          
          <button
            onClick={handleExport}
            disabled={isLoading || !formData.email}
            className="w-full px-4 py-2 text-white font-medium rounded-md bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isLoading ? 'Exporting...' : 'Export Connections'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ScrapingLinkedIn;