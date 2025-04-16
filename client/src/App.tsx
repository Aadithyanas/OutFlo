import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CampaignList } from './components/CampaignList';
import { CampaignForm } from './components/CampaignForm';
import { MessageGenerator } from './components/MessageGenerator';
import { LayoutGrid, MessageSquare } from 'lucide-react';

function App() {
  return (
    <Router>
      <Layout>
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-gray-800 text-white p-4">
            <h1 className="text-2xl font-bold mb-8">Campaign Manager</h1>
            <nav className="space-y-2">
              <Link
                to="/"
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700"
              >
                <LayoutGrid size={20} />
                <span>Campaigns</span>
              </Link>
              <Link
                to="/message-generator"
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700"
              >
                <MessageSquare size={20} />
                <span>Message Generator</span>
              </Link>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto bg-gray-100">
            <Routes>
              <Route path="/" element={<CampaignList />} />
              <Route path="/campaigns/new" element={<CampaignForm />} />
              <Route path="/campaigns/:id" element={<CampaignForm />} />
              <Route path="/message-generator" element={<MessageGenerator />} />
            </Routes>
          </div>
        </div>
      </Layout>
    </Router>
  );
}

export default App;