import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Sliders, 
  FileText, 
  LogOut, 
  Activity, 
  User as UserIcon,
  Globe,
  History,
  Menu,
  X
} from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataEntry from './pages/DataEntry';
import WhatIfSimulator from './pages/WhatIfSimulator';
import ReportsArchive from './pages/ReportsArchive';
import PredictionHistory from './pages/PredictionHistory';

// Setup Toast Notification Context
interface Toast {
  message: string;
  type: 'success' | 'warning' | 'error';
}

interface AuthContextType {
  token: string | null;
  user: { email: string; companyId: string; role: string; id: string } | null;
  login: (token: string, userData: any) => void;
  logout: () => void;
  showToast: (message: string, type?: 'success' | 'warning' | 'error') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const interceptorRef = useRef<number | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully', 'success');
  };

  const login = (newToken: string, userData: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    showToast('Logged in successfully', 'success');
  };

  // Global axios interceptor: auto-logout on 401/403 (expired or invalid JWT)
  useEffect(() => {
    if (interceptorRef.current !== null) {
      axios.interceptors.response.eject(interceptorRef.current);
    }
    interceptorRef.current = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        if ((status === 401 || status === 403) && localStorage.getItem('token')) {
          // Token expired or invalid — clear session and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setToast({ message: 'Your session has expired. Please sign in again.', type: 'error' });
          setTimeout(() => setToast(null), 5000);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
    return () => {
      if (interceptorRef.current !== null) {
        axios.interceptors.response.eject(interceptorRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, showToast }}>
      {children}
      {toast && (
        <div className="toast glass-panel" style={{ 
          borderLeft: `4px solid var(--${toast.type})`, 
          background: 'rgba(15, 23, 42, 0.95)'
        }}>
          <span style={{ fontSize: '18px', color: `var(--${toast.type})` }}>
            {toast.type === 'success' && '✓'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'error' && '✕'}
          </span>
          <span style={{ fontWeight: 500, fontSize: '14px' }}>{toast.message}</span>
        </div>
      )}
    </AuthContext.Provider>
  );
};

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

// Navigation Sidebar Layout
const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Mobile Top Navigation Bar */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity color="var(--primary)" size={24} />
          <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }} className="text-gradient">CarbonIQ</h2>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '6px' }}
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Backdrop Overlay for Mobile */}
      <div 
        className={`mobile-overlay ${mobileMenuOpen ? 'open' : ''}`} 
        onClick={() => setMobileMenuOpen(false)} 
      />

      {/* Sidebar navigation */}
      <aside className={`glass-panel sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div>
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px', padding: '0 8px' }}>
            <Activity color="var(--primary)" size={28} />
            <div>
              <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }} className="text-gradient">CarbonIQ</h2>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Carbon Predictor</span>
            </div>
          </div>

          {/* Nav List */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <NavLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setMobileMenuOpen(false)} />
            <NavLink to="/data-entry" icon={<FileSpreadsheet size={20} />} label="Data Entry" onClick={() => setMobileMenuOpen(false)} />
            <NavLink to="/whatif" icon={<Sliders size={20} />} label="What-If Simulator" onClick={() => setMobileMenuOpen(false)} />
            <NavLink to="/reports" icon={<FileText size={20} />} label="Compliance Reports" onClick={() => setMobileMenuOpen(false)} />
            <NavLink to="/history" icon={<History size={20} />} label="Prediction History" onClick={() => setMobileMenuOpen(false)} />
          </nav>
        </div>

        {/* User profile detail + Logout */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '0 8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserIcon size={18} color="var(--primary)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.email || 'User Account'}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role: {user?.role || 'Member'}</span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }}>
            <LogOut size={16} color="var(--error)" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/data-entry" element={<DataEntry />} />
          <Route path="/whatif" element={<WhatIfSimulator />} />
          <Route path="/reports" element={<ReportsArchive />} />
          <Route path="/history" element={<PredictionHistory />} />
        </Routes>
      </main>
    </div>
  );
};

// Sidebar Navigation Link Helper
const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string; onClick?: () => void }> = ({ to, icon, label, onClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <button 
      onClick={() => {
        navigate(to);
        if (onClick) onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-heading)',
        fontSize: '14px',
        fontWeight: isActive ? 600 : 500,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent'
      }}
      className="nav-btn"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
