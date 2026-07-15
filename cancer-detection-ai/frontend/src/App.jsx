import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { useAuth } from './components/AuthContext';

import Home from './pages/Home';
import Detect from './pages/Detect';
import About from './pages/About';
import Dashboard from './pages/Dashboard';
import HealthHub from './pages/HealthHub';
import DeviceSync from './pages/DeviceSync';
import AiAssistant from './pages/AiAssistant';
import AuthLanding from './pages/AuthLanding';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorDashboard from './pages/DoctorDashboard';

import './index.css';

function RequireAuth({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'doctor' ? '/doctor' : '/dashboard'} replace />;
  }

  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'doctor' ? '/doctor' : '/dashboard'} replace />;
  }

  return children;
}

function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<PublicOnly><AuthLanding /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/detect" element={<RequireAuth><Detect /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/doctor" element={<RequireAuth roles={["doctor"]}><DoctorDashboard /></RequireAuth>} />
          <Route path="/health-hub" element={<RequireAuth><HealthHub /></RequireAuth>} />
          <Route path="/device-sync" element={<RequireAuth><DeviceSync /></RequireAuth>} />
          <Route path="/ai-assistant" element={<RequireAuth><AiAssistant /></RequireAuth>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;