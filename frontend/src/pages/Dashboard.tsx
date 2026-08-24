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
  Tooltip 
} from 'recharts';
import { 
  Leaf, 
  Zap, 
  Truck, 
  Box, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Lightbulb,
  Database,
  RefreshCw,
  Layers,
  PieChart as PieIcon
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
  
  const [period, setPeriod] = useState('2022-12');
  const [data, setData] = useState<SummaryData | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [breakdownMode, setBreakdownMode] = useState<'scopes' | 'categories'>('scopes');

  // Fetch summary and trend data
  const fetchData = async (targetPeriod?: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const activePeriod = targetPeriod || period;
      
      // 1. Fetch Trend data first to get available periods
      const trendRes = await axios.get(`${API_URL}/dashboard/trend`, { headers });
      const trendList = trendRes.data.trends || [];
      setTrends(trendList);

      // Determine period to request: if activePeriod has no calculation in trends, pick latest trend period if available
      let periodToFetch = activePeriod;
      if (trendList.length > 0 && !trendList.some((t: any) => t.period === activePeriod)) {
        periodToFetch = trendList[trendList.length - 1].period;
        setPeriod(periodToFetch);
      }
      
      // 2. Fetch Summary for target period
      const summaryRes = await axios.get(`${API_URL}/dashboard/summary`, {
        headers,
        params: { period: periodToFetch }
      });
      
      setData(summaryRes.data);
      
    } catch (err: any) {
      console.error(err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('Session expired. Redirecting to login...');
      } else if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to backend server. Please check service health.');
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
  }, [token]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    fetchData(newPeriod);
  };

  const handleSeedData = async () => {
    if (!token) return;
    setSeeding(true);
    showToast('Seeding 2015-2022 dataset and calculations to your company...', 'warning');
    try {
      await axios.post(`${API_URL}/history/seed-my-company`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Successfully seeded company dataset! Updating dashboard...', 'success');
      fetchData('2022-12');
    } catch (err) {
      console.error(err);
      showToast('Failed to seed dataset', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const SCOPE_COLORS = {
    'Scope 1 (Direct)': '#3b82f6',
    'Scope 2 (Energy)': '#10b981',
    'Scope 3 (Supply Chain)': '#8b5cf6'
  };

  const getScopeValue = (scope: number) => {
    if (!data?.calculationResult) return 0;
    const { scope1Kg, scope2Kg, scope3Kg } = data.calculationResult;
    if (scope === 1) return scope1Kg / 1000;
    if (scope === 2) return scope2Kg / 1000;
    return scope3Kg / 1000;
  };

  const getTotal = () => {
    return data?.calculationResult ? data.calculationResult.totalKg / 1000 : 0;
  };

  // Scope 1, 2, 3 Data Array for Pie Chart
  const getScopePieData = () => {
    if (!data?.calculationResult) return [];
    const s1 = data.calculationResult.scope1Kg / 1000;
    const s2 = data.calculationResult.scope2Kg / 1000;
    const s3 = data.calculationResult.scope3Kg / 1000;
    const total = s1 + s2 + s3;

    if (total === 0) return [];
    return [
      { name: 'Scope 1 (Direct)', kg: data.calculationResult.scope1Kg, tons: s1, pct: (s1 / total) * 100, fill: '#3b82f6' },
      { name: 'Scope 2 (Energy)', kg: data.calculationResult.scope2Kg, tons: s2, pct: (s2 / total) * 100, fill: '#10b981' },
      { name: 'Scope 3 (Supply Chain)', kg: data.calculationResult.scope3Kg, tons: s3, pct: (s3 / total) * 100, fill: '#8b5cf6' }
    ];
  };

  return (
    <div>
      {/* Top Header Panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Emissions Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Real-time Scope 1/2/3 calculations and model correction offsets</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Seed Data Button */}
          <button 
            onClick={handleSeedData}
            disabled={seeding}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
            title="Populate company database with 2015-2022 dataset"
          >
            <Database size={16} color="var(--primary)" />
            <span>{seeding ? 'Seeding...' : 'Seed Sample Dataset'}</span>
          </button>

          {/* Dynamic Reporting Period Dropdown */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', gap: '8px' }}>
            <Calendar size={16} color="var(--primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Period:</span>
            
            {trends.length > 0 ? (
              <select 
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '14px',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {trends.map(t => (
                  <option key={t.period} value={t.period} style={{ background: '#0f172a', color: '#fff' }}>
                    {t.period} ({(t.totalKg / 1000).toFixed(1)}t)
                  </option>
                ))}
              </select>
            ) : (
              <input 
                type="month" 
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
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
            )}
          </div>
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
            <h4 style={{ color: 'var(--error)', margin: 0, fontWeight: 700 }}>Connection Status</h4>
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
          {/* Empty Data Prompt */}
          {!data?.calculationResult && trends.length === 0 && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
              <Database size={36} color="var(--primary)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Emissions Data Found for this Company</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                Your company database currently has no calculation records. Click below to seed the benchmark 2015-2022 dataset or navigate to Data Entry.
              </p>
              <button 
                onClick={handleSeedData} 
                className="btn btn-primary"
                disabled={seeding}
                style={{ marginTop: '16px', padding: '10px 24px' }}
              >
                {seeding ? 'Seeding Database...' : 'Seed Sample Dataset Now'}
              </button>
            </div>
          )}

          {/* Scope Summary Cards */}
          <section className="dashboard-grid" style={{ padding: 0, marginBottom: '24px' }}>
            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3', borderTop: '3px solid #3b82f6' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 1 (Direct)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0', color: '#3b82f6' }}>
                {getScopeValue(1).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
              </h2>
              <span style={{ fontSize: '11px', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Direct Fuel Combustion</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3', borderTop: '3px solid #10b981' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 2 (Energy)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0', color: '#10b981' }}>
                {getScopeValue(2).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
              </h2>
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Purchased Grid Power</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3', borderTop: '3px solid #8b5cf6' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Scope 3 (Supply Chain)</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0', color: '#8b5cf6' }}>
                {getScopeValue(3).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
              </h2>
              <span style={{ fontSize: '11px', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>Freight & Material Sourcing</span>
            </div>

            <div className="glass-panel metric-card" style={{ gridColumn: 'span 3', borderLeft: '3px solid var(--primary)' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Footprint</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px 0' }} className="text-gradient">
                {getTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content' }}>ML Corrected Inventory</span>
            </div>
          </section>

          {/* Charts Row */}
          <section className="dashboard-grid" style={{ padding: 0, marginBottom: '24px' }}>
            {/* Pie Chart Breakdown with Scope 1, 2, 3 Toggle */}
            <div className="glass-panel chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieIcon size={18} color="var(--primary)" />
                  <span>Emissions Inventory Breakdown</span>
                </h3>

                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px' }}>
                  <button
                    onClick={() => setBreakdownMode('scopes')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: breakdownMode === 'scopes' ? 'var(--primary)' : 'transparent',
                      color: breakdownMode === 'scopes' ? '#0f172a' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Scope 1/2/3
                  </button>
                  <button
                    onClick={() => setBreakdownMode('categories')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: breakdownMode === 'categories' ? 'var(--primary)' : 'transparent',
                      color: breakdownMode === 'categories' ? '#0f172a' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Category Types
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', height: '230px', alignItems: 'center' }}>
                {breakdownMode === 'scopes' ? (
                  /* Scope 1, 2, 3 Breakdown Mode */
                  <>
                    <div style={{ width: '50%', height: '100%' }}>
                      {getScopePieData().length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getScopePieData()}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="kg"
                              nameKey="name"
                            >
                              {getScopePieData().map((entry, index) => (
                                <Cell key={`scope-cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Emissions']}
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No calculation data in period {period}
                        </div>
                      )}
                    </div>

                    <div style={{ width: '50%', paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {getScopePieData().map((item) => (
                          <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.fill }}></div>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{item.name}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '18px' }}>
                              <b>{item.tons.toFixed(2)} t</b> ({item.pct.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Category Activity Breakdown Mode */
                  <>
                    <div style={{ width: '50%', height: '100%' }}>
                      {data?.calculationResult?.breakdown && data.calculationResult.breakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.calculationResult.breakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="kg"
                              nameKey="activityType"
                            >
                              {data.calculationResult.breakdown.map((entry, index) => (
                                <Cell key={`cat-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Emissions']}
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No activity breakdown in period {period}
                        </div>
                      )}
                    </div>

                    <div style={{ width: '50%', paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data?.calculationResult?.breakdown.map((item, idx) => (
                          <div key={item.activityType} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                            <span style={{ fontSize: '12px', textTransform: 'capitalize', fontWeight: 600 }}>{item.activityType}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({item.pct.toFixed(1)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Line Chart Multi-Year Trend */}
            <div className="glass-panel chart-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--primary)" />
                <span>Emissions Multi-Period Trend</span>
              </h3>
              <div style={{ height: '230px' }}>
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
                        formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Total Footprint']}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No historical trend records. Click "Seed Sample Dataset" above.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Explainability Diagnostics Section */}
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
                  <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                    XGBRegressor Correction Active
                  </span>
                  <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                    Model Version: {data?.calculationResult?.modelVersion || '1.0.0 (XGBoost)'}
                  </span>
                </div>
              </div>

              {/* SHAP List factors */}
              <div style={{ width: '450px', borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
                <h4 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>Top Predictor Drivers</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {data?.explainabilityResult?.topFactors && data.explainabilityResult.topFactors.length > 0 ? (
                    data.explainabilityResult.topFactors.map((item, idx) => (
                      <div key={item.feature} style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '6px', 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '11px',
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
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '16px' }}>
                            {item.plainLanguage}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      Standard static factor calculations applied for period {period}.
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
