import  { useState } from 'react';

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CampaignList } from './components/CampaignList';
import { CampaignForm } from './components/CampaignForm';
import { MessageGenerator } from './components/MessageGenerator';
import { LayoutGrid, MessageSquare, Menu, X } from 'lucide-react';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Router>
      <Layout>
        <div className="flex h-screen relative">
          {/* Mobile Menu Button */}
          <button 
            onClick={toggleSidebar} 
            className="md:hidden fixed top-4 left-4 z-50 bg-blue-800 p-2 rounded-md shadow-lg text-white hover:bg-blue-700 transition-all duration-300"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Sidebar - Mobile Overlay */}
          {sidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={toggleSidebar}
            ></div>
          )}

          {/* Sidebar */}
          <div 
            className={`${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 fixed md:relative z-40 w-64 h-full transition-transform duration-300 ease-in-out`}
          >
            <div className="h-full bg-gradient-to-br from-gray-900 via-red-400 to-gray-900 text-white p-6 overflow-y-auto shadow-xl">
              <div className="relative overflow-hidden rounded-lg p-4 mb-8 bg-gradient-to-r from-blue-800 to-purple-800">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-blue-500/30 animate-gradient-xy"></div>
                <h1 className="text-2xl font-bold relative z-10 text-center animate-pulse-text">Campaign Manager</h1>
              </div>
              
              <nav className="space-y-3">
                <Link
                  to="/"
                  className="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 hover:bg-white/10 relative group overflow-hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-purple-600/0 group-hover:from-blue-600/20 group-hover:to-purple-600/20 transition-all duration-300"></div>
                  <div className="p-2 rounded-md bg-blue-800/50 group-hover:bg-blue-700 transition-all duration-300">
                    <LayoutGrid size={18} />
                  </div>
                  <span className="font-medium">Campaigns</span>
                  <div className="absolute bottom-0 left-0 h-0.5 w-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 bg-gradient-to-r from-blue-400 to-purple-400"></div>
                </Link>
                
                <Link
                  to="/message-generator"
                  className="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 hover:bg-white/10 relative group overflow-hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-purple-600/0 group-hover:from-blue-600/20 group-hover:to-purple-600/20 transition-all duration-300"></div>
                  <div className="p-2 rounded-md bg-purple-800/50 group-hover:bg-purple-700 transition-all duration-300">
                    <MessageSquare size={18} />
                  </div>
                  <span className="font-medium">Message Generator</span>
                  <div className="absolute bottom-0 left-0 h-0.5 w-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 bg-gradient-to-r from-blue-400 to-purple-400"></div>
                </Link>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-900 to-blue-900 ml-0  transition-all duration-300">
            <div >
              <Routes>
                <Route path="/" element={<CampaignList />} />
                <Route path="/campaigns/new" element={<CampaignForm />} />
                <Route path="/campaigns/:id" element={<CampaignForm />} />
                <Route path="/message-generator" element={<MessageGenerator />} />
              </Routes>
            </div>
          </div>
        </div>

        <style >{`
          @keyframes gradient-xy {
            0%, 100% {
              background-position: 0% 0%;
            }
            25% {
              background-position: 100% 0%;
            }
            50% {
              background-position: 100% 100%;
            }
            75% {
              background-position: 0% 100%;
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
          
          .animate-gradient-xy {
            animation: gradient-xy 15s ease infinite;
            background-size: 400% 400%;
          }
          
          .animate-pulse-text {
            animation: pulse-text 3s infinite ease-in-out;
          }
        `}</style>
      </Layout>
    </Router>
  );
}

export default App;