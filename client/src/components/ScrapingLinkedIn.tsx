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
  data?: any;
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
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  // Check for dark mode preference
  useEffect(() => {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDarkMode);
  }, []);

  // Handle dark mode toggle
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Handle form input changes with animation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'maxConnections' ? parseInt(value) || 0 : value
    });
  };

  // Handle form submission
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
        if (response.data.data) {
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
  
  // Handle export
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
  
  // Fixed getDetailedData function with proper URL and implementation
  const getDetailedData = async () => {
    if (selectedProfiles.length === 0) {
      setError("Please select profiles to get detailed data");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post<ApiResponse>('https://outflo-1.onrender.com/api/scraper/detailed-profiles', {
        email: formData.email,
        password: formData.password,
        urls: selectedProfiles
      });
  
      if (response.data.success) {
        setSuccess("Detailed data fetched successfully!");
        if (response.data.data) {
          // Update connections with detailed data
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

  // Handle profile selection for detailed data
  const toggleProfileSelection = (profileUrl: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileUrl)
        ? prev.filter(url => url !== profileUrl)
        : [...prev, profileUrl]
    );
  };

  // Dynamic classes based on dark mode
  const containerClass = darkMode 
    ? "max-w-4xl mx-auto p-6 mt-16 bg-gray-800 rounded-lg shadow-lg text-white transition-all duration-300"
    : "max-w-4xl mx-auto p-6 mt-16 bg-white rounded-lg shadow-lg transition-all duration-300";

  const inputClass = darkMode
    ? "mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-white transition-all duration-300"
    : "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-all duration-300";

  const buttonClass = darkMode
    ? "w-full px-4 py-2 text-white font-medium rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transform hover:scale-105 transition-all duration-300"
    : "w-full px-4 py-2 text-white font-medium rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transform hover:scale-105 transition-all duration-300";

  const tableClass = darkMode
    ? "min-w-full bg-gray-700 border border-gray-600 transition-all duration-300"
    : "min-w-full bg-white border border-gray-200 transition-all duration-300";

  const tableHeaderClass = darkMode
    ? "bg-gray-800 text-gray-300 transition-all duration-300"
    : "bg-gray-100 text-gray-500 transition-all duration-300";

  const tableRowClass = darkMode
    ? "hover:bg-gray-600 transition-all duration-300"
    : "hover:bg-gray-50 transition-all duration-300";

  const tabClass = (isActive: boolean) => darkMode
    ? `px-4 py-2 ${isActive ? 'border-b-2 border-blue-500 font-medium text-blue-400' : 'text-gray-400'} transition-all duration-300`
    : `px-4 py-2 ${isActive ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'} transition-all duration-300`;

  return (
    <div className={containerClass}>
      <div className="flex justify-between items-center mb-8">
        <h1 className={`text-2xl font-bold text-center ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
          LinkedIn Connection Scraper
        </h1>
        <button 
          onClick={toggleDarkMode}
          className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex mb-6 border-b">
        <button 
          onClick={() => setActiveTab('scrape')} 
          className={tabClass(activeTab === 'scrape')}
        >
          Scrape Connections
        </button>
        <button 
          onClick={() => setActiveTab('results')} 
          className={tabClass(activeTab === 'results')}
          disabled={connections.length === 0}
        >
          Results ({connections.length})
        </button>
        <button 
          onClick={() => setActiveTab('export')} 
          className={tabClass(activeTab === 'export')}
        >
          Export
        </button>
      </div>
      
      {/* Alerts */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 animate-pulse" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 animate-pulse" role="alert">
          <p className="font-bold">Success</p>
          <p>{success}</p>
        </div>
      )}
      
      {/* Scrape Form Tab */}
      {activeTab === 'scrape' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="transform transition-all duration-300 hover:translate-y-1">
              <label htmlFor="email" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                LinkedIn Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="your.email@example.com"
              />
            </div>
            
            <div className="transform transition-all duration-300 hover:translate-y-1">
              <label htmlFor="password" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                  className={inputClass}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className={`absolute inset-y-0 right-0 px-3 py-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            
            <div className="transform transition-all duration-300 hover:translate-y-1">
              <label htmlFor="maxConnections" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Max Connections to Scrape (0 for all)
              </label>
              <input
                type="number"
                id="maxConnections"
                name="maxConnections"
                value={formData.maxConnections}
                onChange={handleChange}
                min="0"
                className={inputClass}
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={buttonClass}
            >
              {isLoading ? 
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scraping...
                </span> : 
                'Start Scraping'
              }
            </button>
          </div>
          
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>
            <p>Note: This tool uses your LinkedIn credentials to log in and scrape your connections. Your credentials are never stored.</p>
          </div>
        </form>
      )}
      
      {/* Results Tab */}
      {activeTab === 'results' && (
        <div>
          {connections.length > 0 && (
            <div className="mb-4 flex justify-between items-center">
              <div>
                <span className={`mr-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {selectedProfiles.length} profiles selected
                </span>
              </div>
              <button
                onClick={getDetailedData}
                disabled={isLoading || selectedProfiles.length === 0}
                className={`px-4 py-2 text-white font-medium rounded-md ${darkMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transform hover:scale-105 transition-all duration-300`}
              >
                {isLoading ? 'Fetching Details...' : 'Get Detailed Info'}
              </button>
            </div>
          )}
        
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={tableHeaderClass}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Select</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Title/About</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                {connections.map((connection, index) => (
                  <tr key={index} className={`${tableRowClass} ${index % 2 === 0 ? (darkMode ? 'bg-gray-800' : 'bg-gray-50') : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProfiles.includes(connection.profile_url)}
                        onChange={() => toggleProfileSelection(connection.profile_url)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 transform transition-all duration-300 hover:translate-x-1">
                      {connection.name}
                    </td>
                    <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {connection.about}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a 
                        href={connection.profile_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transform transition-all duration-300 hover:translate-x-1 inline-block`}
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
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                No connections have been scraped yet.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="py-6">
          <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Export all your scraped LinkedIn connections as a JSON file. This file will contain all the information that has been collected from your connections.
          </p>
          
          <div className="mb-4 transform transition-all duration-300 hover:translate-y-1">
            <label htmlFor="exportEmail" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Email used for scraping
            </label>
            <input
              type="email"
              id="exportEmail"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder="your.email@example.com"
            />
          </div>
          
          <button
            onClick={handleExport}
            disabled={isLoading || !formData.email}
            className={`w-full px-4 py-2 text-white font-medium rounded-md ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transform hover:scale-105 transition-all duration-300`}
          >
            {isLoading ? 
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </span> : 
              'Export Connections'
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default ScrapingLinkedIn;