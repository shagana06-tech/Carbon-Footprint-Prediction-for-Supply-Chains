import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  Leaf, 
  Zap, 
  Truck, 
  Box, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface SummaryData {
  calculationResult: {
    _id: string;
    period: string;
    scope1Kg: number;
    scope2Kg: number;
    scope3Kg: number;
    totalKg: number;
    baselineTotalKg: number;
    correctedTotalKg: number;
    breakdown: Array<{ activityType: string; kg: number; pct: number }>;
    modelVersion: string;
  } | null;
  explainabilityResult: {
    topFactors: Array<{ feature: string; contributionPct: number; plainLanguage: string }>;
  };
}

const Dashboard: React.FC = () => {
  const { token, showToast } = useAuth();
  
  // Set default period to Apple's latest seeded year (2022-12) or current period
  const [period, setPeriod] = useState('2022-12');
  const [data, setData] = useState<SummaryData | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch summary and trend data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // 1. Fetch Summary for selected period
      const summaryRes = await axios.get(`${API_URL}/dashboard/summary`, {
        headers,
        params: { period }
      });
      
      setData(summaryRes.data);
      
      // 2. Fetch Trend data
      const trendRes = await axios.get(`${API_URL}/dashboard/trend`, { headers });
      setTrends(trendRes.data.trends || []);
      
    } catch (err: any) {
      console.error(err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        // Interceptor will handle redirect; don't show misleading error
        setError('Session expired. Redirecting to login...');
      } else if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to backend (port 5000). Please start the backend server and refresh.');
      } else {
        setError(`Server error (${status || 'unknown'}): ${err.response?.data?.detail || err.message}`);
      }
      showToast('Error fetching dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, token]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const getIcon = (type: string) => {
    switch (type) {
      case 'diesel': return <Leaf size={18} color="#3b82f6" />;
      case 'electricity': return <Zap size={18} color="#10b981" />;
      case 'roadTransport': return <Truck size={18} color="#f59e0b" />;
      case 'rawMaterial': return <Box size={18} color="#8b5cf6" />;
      default: return <Leaf size={18} color="#10b981" />;
    }
  };

  const getScopeValue = (scope: number) => {
    if (!data?.calculationResult) return 0;
    const { scope1Kg, scope2Kg, scope3Kg } = data.calculationResult;
    if (scope === 1) return scope1Kg / 1000; // Convert to Metric Tons
    if (scope === 2) return scope2Kg / 1000;
    return scope3Kg / 1000;
  };

  const getTotal = () => {
    return data?.calculationResult ? data.calculationResult.totalKg / 1000 : 0;
  };

  return (
    <div>
      {/* Top Header Panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Emissions Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Real-time Scope 1/2/3 calculations and model correction offsets</p>
        </div>

        {/* Date Filter selector */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '10px' }}>
          <Calendar size={16} color="var(--primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Reporting Period:</span>
          <input 
            type="month" 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-heading)',
              fontSize: '14px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.2)',
          padding: '20px',
          marginBottom: '32px',
          color: 'var(--text-main)'
        }}>
          <AlertTriangle color="var(--error)" size={24} style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ color: 'var(--error)', margin: 0, fontWeight: 700 }}>Connection Offline</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(16, 185, 129, 0.1)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Cards */}
          <section className="dashboard-grid" style={{ padding: 0, marginBottom: '24px' }}>
            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 1 (Direct)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0' }}>{getScopeValue(1).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span></h2>
              <span style={{ fontSize: '11px', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Direct Fuel Burn</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 2 (Energy)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0' }}>{getScopeValue(2).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span></h2>
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Purchased Grid Load</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 3 (Supply Chain)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0' }}>{getScopeValue(3).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span></h2>
              <span style={{ fontSize: '11px', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Freight & Sourcing</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3', borderLeft: '2px solid var(--primary)' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Footprint</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0' }} className="text-gradient">{getTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span></h2>
              <span style={{ fontSize: '11px', color: 'var(--primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Model Corrected Sum</span>
            </div>
          </section>

          {/* Charts Row */}
          <section className="dashboard-grid" style={{ padding: 0, marginBottom: '24px' }}>
            {/* Pie Chart breakdown */}
            <div className="glass-panel chart-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Category Contribution Breakdown</h3>
              <div style={{ display: 'flex', height: '240px', alignItems: 'center' }}>
                <div style={{ width: '50%', height: '100%' }}>
                  {data?.calculationResult?.breakdown && data.calculationResult.breakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.calculationResult.breakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="kg"
                          nameKey="activityType"
                        >
                          {data.calculationResult.breakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Emissions']}
                          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data in this period</div>
                  )}
                </div>

                {/* Custom Legend */}
                <div style={{ width: '50%', paddingLeft: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data?.calculationResult?.breakdown.map((item, idx) => (
                      <div key={item.activityType} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                        <span style={{ fontSize: '12px', textTransform: 'capitalize', fontWeight: 600 }}>{item.activityType}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({item.pct.toFixed(1)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Chart multi-year trend */}
            <div className="glass-panel chart-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Emissions Multi-Period Trend</h3>
              <div style={{ height: '240px' }}>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis 
                        dataKey="period" 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        tickLine={false} 
                        tickFormatter={(v) => `${(v/1000).toFixed(0)}t`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Aggregate']}
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalKg" 
                        stroke="var(--primary)" 
                        strokeWidth={2}
                        dot={{ fill: 'var(--primary)', strokeWidth: 1, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No historical trend data. Try seeding Apple Demo.</div>
                )}
              </div>
            </div>
          </section>

          {/* Explainability Section */}
          <section className="dashboard-grid" style={{ padding: 0 }}>
            <div className="glass-panel full-card" style={{ display: 'flex', gap: '32px' }}>
              <div style={{ flex: '1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Lightbulb color="var(--primary)" size={24} />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Explainable AI (SHAP) Diagnostics</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '20px', marginBottom: '16px' }}>
                  Standard emissions reporting relies on static grid factors. Our platform integrates an <b>XGBoost Machine Learning regressor</b> to adjust baseline calculations. This correction dynamically accounts for equipment performance wear (machinery age), spatial temperature variances (seasonality), and load density factor spikes.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    XGBRegressor Correction
                  </span>
                  <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    Model Version: {data?.calculationResult?.modelVersion || '1.0.0'}
                  </span>
                </div>
              </div>

              {/* SHAP List factors */}
              <div style={{ width: '450px', borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
                <h4 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>Top Predictor Drivers</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {data?.explainabilityResult?.topFactors && data.explainabilityResult.topFactors.length > 0 ? (
                    data.explainabilityResult.topFactors.map((item, idx) => (
                      <div key={item.feature} style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '8px', 
                          background: 'rgba(16, 185, 129, 0.08)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--primary)'
                        }}>
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize' }}>
                              {item.feature === 'baselineKg' ? 'Baseline Emission Factor' : 
                               item.feature === 'equipmentAgeYears' ? 'Equipment Age' : item.feature}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>({item.contributionPct.toFixed(1)}% weight)</span>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '16px' }}>
                            {item.plainLanguage}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      No AI model corrections applied yet. Standard mathematical baselines active.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
