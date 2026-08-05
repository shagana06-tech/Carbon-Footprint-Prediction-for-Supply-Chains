import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { Activity, ShieldAlert, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [country, setCountry] = useState('India');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, showToast } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        // Register API Call
        const res = await axios.post(`${API_URL}/auth/register`, {
          email,
          password,
          companyName,
          industry,
          country
        });
        login(res.data.token, res.data.user);
        showToast('Registered and logged in successfully!', 'success');
        navigate('/');
      } else {
        // Login API Call
        const res = await axios.post(`${API_URL}/auth/login`, {
          email,
          password
        });
        login(res.data.token, res.data.user);
        showToast('Welcome back!', 'success');
        navigate('/');
      }
    } catch (err: any) {
      let errMsg: string;
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response) {
        errMsg = 'Cannot connect to server. Please ensure the backend is running on port 5000.';
      } else {
        errMsg = err.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      }
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutofillDemo = async () => {
    // Directly log in with demo credentials to avoid React state async race condition
    const demoEmail = 'shaganasundar9@gmail.com';
    const demoPassword = 'wannabeme';
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsRegister(false);
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: demoEmail,
        password: demoPassword
      });
      login(res.data.token, res.data.user);
      showToast('Welcome! Logged in with admin credentials.', 'success');
      navigate('/');
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Auto-login failed. Please try manually.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '450px',
        padding: '40px',
        position: 'relative',
        background: 'rgba(15, 23, 42, 0.75)'
      }}>
        {/* Header Icon & Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '16px', 
            background: 'rgba(16, 185, 129, 0.1)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Activity color="var(--primary)" size={32} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', margin: 0 }} className="text-gradient">
            {isRegister ? 'Create Carbon Workspace' : 'Sign in to Platform'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '6px' }}>
            Predict, simulate, and report Scope 1/2/3 emissions
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            color: 'var(--error)',
            fontSize: '13px'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <select 
                    className="form-input"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    style={{ appearance: 'none' }}
                  >
                    <option value="Technology">Technology</option>
                    <option value="Textiles">Textiles</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Agriculture">Agriculture</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="India"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : isRegister ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
          <button 
            onClick={() => setIsRegister(!isRegister)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register company"}
          </button>

          {!isRegister && (
            <button 
              onClick={handleAutofillDemo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--border-glow)',
                color: 'var(--primary)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              className="demo-btn"
            >
              <Award size={14} />
              <span>Autofill Apple Inc. Demo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
