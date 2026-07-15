import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Detect from './pages/Detect';
import About from './pages/About';
import Dashboard from './pages/Dashboard';
import HealthHub from './pages/HealthHub';
import DeviceSync from './pages/DeviceSync';
import AiAssistant from './pages/AiAssistant';

import './index.css';

function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/detect"      element={<Detect />} />
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/health-hub"  element={<HealthHub />} />
          <Route path="/device-sync" element={<DeviceSync />} />
          <Route path="/ai-assistant" element={<AiAssistant />} />
          <Route path="/about"       element={<About />} />
          <Route path="*"            element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;