import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { 
  History, 
  Search, 
  Eye, 
  Trash2, 
  Database, 
  Layers, 
  Cpu, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  Calendar, 
  FileSpreadsheet, 
  Zap, 
  Leaf, 
  Truck, 
  Box,
  RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface RawEntry {
  activityType: string;
  quantity: number;
  unit: string;
  region: string;
  equipmentAgeYears?: number;
  cargoWeightTons?: number;
  baselineKg?: number;
}

interface PredictionLogItem {
  _id: string;
  period: string;
  triggerType: 'manual_entry' | 'bulk_upload' | 'demo_seed' | 'recalculation';
  timestamp: string;
  prePredictionBaseline: {
    scope1Kg: number;
    scope2Kg: number;
    scope3Kg: number;
    totalKg: number;
    entryCount: number;
    rawEntries: RawEntry[];
  };
  postPredictionModel: {
    correctedTotalKg: number;
    scope1Kg: number;
    scope2Kg: number;
    scope3Kg: number;
    deltaKg: number;
    deltaPct: number;
    modelVersion: string;
    topFactors: Array<{
      feature: string;
      contributionPct: number;
      plainLanguage: string;
    }>;
    breakdown: Array<{
      activityType: string;
      kg: number;
      pct: number;
    }>;
  };
}

const PredictionHistory: React.FC = () => {
  const { token, showToast } = useAuth();
  const [logs, setLogs] = useState<PredictionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<PredictionLogItem | null>(null);
  const [activeTab, setActiveTab] = useState<'pre' | 'post' | 'scopes'>('pre');

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading prediction history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleSeedData = async () => {
    if (!token) return;
    setSeeding(true);
    showToast('Seeding 2015-2022 historical datasets and logs...', 'warning');
    try {
      await axios.post(`${API_URL}/history/seed-my-company`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Successfully seeded historical calculation logs!', 'success');
      fetchHistory();
    } catch (err) {
      console.error(err);
      showToast('Failed to seed historical dataset', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this prediction log?')) return;
    try {
      await axios.delete(`${API_URL}/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Log record removed', 'success');
      setLogs(prev => prev.filter(l => l._id !== id));
      if (selectedLog?._id === id) setSelectedLog(null);
    } catch (err) {
      showToast('Failed to delete log entry', 'error');
    }
  };

  const filteredLogs = logs.filter(log => 
    log.period.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.triggerType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'diesel': return <Leaf size={14} color="#3b82f6" />;
      case 'electricity': return <Zap size={14} color="#10b981" />;
      case 'roadTransport': return <Truck size={14} color="#f59e0b" />;
      case 'rawMaterial': return <Box size={14} color="#8b5cf6" />;
      default: return <Layers size={14} color="var(--primary)" />;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Prediction & Audit History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Trace pre-prediction baseline inputs against ML model corrections and SHAP feature allocations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchHistory}
            className="btn btn-secondary"
            style={{ padding: '10px 16px', fontSize: '13px' }}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>

          <button 
            onClick={handleSeedData} 
            className="btn btn-primary"
            disabled={seeding}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            <Database size={16} />
            <span>{seeding ? 'Seeding Dataset...' : 'Seed Sample Dataset (2015-2022)'}</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '320px', background: 'rgba(255,255,255,0.03)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search by period (YYYY-MM) or type..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '13px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Showing <b>{filteredLogs.length}</b> prediction log records
        </div>
      </div>

      {/* Main History Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16, 185, 129, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <History size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>No History Logs Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
            Click <b>"Seed Sample Dataset"</b> above to load Apple FY2015-FY2022 historical logs, or perform operational entries in Data Entry to generate new logs.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 20px' }}>Period</th>
                <th style={{ padding: '16px' }}>Run Timestamp</th>
                <th style={{ padding: '16px' }}>Trigger</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Pre-Prediction (t CO2e)</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Post-Prediction (t CO2e)</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>ML Variance</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const preT = log.prePredictionBaseline?.totalKg ? (log.prePredictionBaseline.totalKg / 1000).toFixed(2) : '0.00';
                const postT = log.postPredictionModel?.correctedTotalKg ? (log.postPredictionModel.correctedTotalKg / 1000).toFixed(2) : '0.00';
                const deltaPct = log.postPredictionModel?.deltaPct || 0;
                const isDecrease = deltaPct <= 0;

                return (
                  <tr 
                    key={log._id}
                    onClick={() => { setSelectedLog(log); setActiveTab('pre'); }}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s' }}
                    className="report-item"
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={16} color="var(--primary)" />
                        <span>{log.period}</span>
                      </div>
                    </td>

                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontWeight: 600,
                        background: log.triggerType === 'demo_seed' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        color: log.triggerType === 'demo_seed' ? '#3b82f6' : 'var(--primary)',
                        textTransform: 'capitalize'
                      }}>
                        {log.triggerType.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {preT} t
                    </td>

                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                      {postT} t
                    </td>

                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        background: isDecrease ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isDecrease ? 'var(--primary)' : 'var(--error)'
                      }}>
                        {isDecrease ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                        <span>{deltaPct > 0 ? `+${deltaPct.toFixed(1)}%` : `${deltaPct.toFixed(1)}%`}</span>
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setActiveTab('pre'); }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          title="View Pre-Prediction Log Details"
                        >
                          <Eye size={14} color="var(--primary)" />
                          <span>Inspect Log</span>
                        </button>

                        <button 
                          onClick={(e) => handleDeleteLog(log._id, e)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          title="Delete Log"
                        >
                          <Trash2 size={14} color="var(--error)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pre-Prediction & Post-Prediction Inspection Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            width: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu color="var(--primary)" size={22} />
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                    Prediction Log Inspection — Period {selectedLog.period}
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Logged at {new Date(selectedLog.timestamp).toLocaleString()}  ·  Trigger: {selectedLog.triggerType}
                </span>
              </div>

              <button 
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
              <button 
                onClick={() => setActiveTab('pre')}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: activeTab === 'pre' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'pre' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === 'pre' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                1. Pre-Prediction Baseline Inputs
              </button>

              <button 
                onClick={() => setActiveTab('post')}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: activeTab === 'post' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'post' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === 'post' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                2. ML Model Corrections & SHAP
              </button>

              <button 
                onClick={() => setActiveTab('scopes')}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: activeTab === 'scopes' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'scopes' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === 'scopes' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                3. Scope 1 / Scope 2 / Scope 3 Breakdown
              </button>
            </div>

            {/* Modal Body Content */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
              {activeTab === 'pre' && (
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Pre-Prediction Raw Activity Inputs</h4>

                  {/* Summary Metric Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Baseline Output</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', margin: 0 }}>
                        {selectedLog.prePredictionBaseline?.totalKg ? (selectedLog.prePredictionBaseline.totalKg / 1000).toFixed(2) : '0.00'} t CO2e
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Processed Entries</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', margin: 0 }}>
                        {selectedLog.prePredictionBaseline?.entryCount || selectedLog.prePredictionBaseline?.rawEntries?.length || 0} line items
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Baseline Method</span>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px', margin: 0, color: 'var(--primary)' }}>
                        Static GHG Emission Factors
                      </h3>
                    </div>
                  </div>

                  {/* Raw Input Table */}
                  {selectedLog.prePredictionBaseline?.rawEntries && selectedLog.prePredictionBaseline.rawEntries.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', fontSize: '10px' }}>
                          <th style={{ padding: '10px' }}>Activity</th>
                          <th style={{ padding: '10px' }}>Quantity</th>
                          <th style={{ padding: '10px' }}>Unit</th>
                          <th style={{ padding: '10px' }}>Region</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Baseline Emission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLog.prePredictionBaseline.rawEntries.map((e, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                              {getActivityIcon(e.activityType)}
                              <span style={{ textTransform: 'capitalize' }}>{e.activityType}</span>
                            </td>
                            <td style={{ padding: '10px' }}>{e.quantity.toLocaleString()}</td>
                            <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{e.unit}</td>
                            <td style={{ padding: '10px' }}>{e.region}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>
                              {e.baselineKg ? (e.baselineKg / 1000).toFixed(3) : '0.000'} t CO2e
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                      Raw input log summary saved to database.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'post' && (
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Machine Learning Post-Prediction Corrections</h4>

                  {/* Pre vs Post Comparison Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Static Baseline</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', margin: 0, color: 'var(--text-muted)' }}>
                        {selectedLog.prePredictionBaseline?.totalKg ? (selectedLog.prePredictionBaseline.totalKg / 1000).toFixed(2) : '0.00'} t
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 600 }}>ML Corrected Total</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', margin: 0, color: 'var(--primary)' }}>
                        {selectedLog.postPredictionModel?.correctedTotalKg ? (selectedLog.postPredictionModel.correctedTotalKg / 1000).toFixed(2) : '0.00'} t
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ML Model Version</span>
                      <h3 style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px', margin: 0 }}>
                        {selectedLog.postPredictionModel?.modelVersion || '1.0.0 (XGBoost Regressor)'}
                      </h3>
                    </div>
                  </div>

                  {/* SHAP Factors */}
                  <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Top Predictor Driver Factors (SHAP Weights)
                  </h5>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedLog.postPredictionModel?.topFactors && selectedLog.postPredictionModel.topFactors.length > 0 ? (
                      selectedLog.postPredictionModel.topFactors.map((factor, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize' }}>{factor.feature}</span>
                              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>{factor.contributionPct.toFixed(1)}% weight</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{factor.plainLanguage}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Standard mathematical baseline active. No ML uplift adjustments needed for this inventory.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'scopes' && (
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Complete Scope 1, Scope 2, Scope 3 Inventory</h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Scope 1 */}
                    <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 700 }}>Scope 1 (Direct)</span>
                      <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#3b82f6' }}>
                        {((selectedLog.postPredictionModel?.scope1Kg || selectedLog.prePredictionBaseline?.scope1Kg || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Direct fuel combustion & operations
                      </span>
                    </div>

                    {/* Scope 2 */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase', fontWeight: 700 }}>Scope 2 (Energy)</span>
                      <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
                        {((selectedLog.postPredictionModel?.scope2Kg || selectedLog.prePredictionBaseline?.scope2Kg || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Purchased grid electricity load
                      </span>
                    </div>

                    {/* Scope 3 */}
                    <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#8b5cf6', textTransform: 'uppercase', fontWeight: 700 }}>Scope 3 (Supply Chain)</span>
                      <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#8b5cf6' }}>
                        {((selectedLog.postPredictionModel?.scope3Kg || selectedLog.prePredictionBaseline?.scope3Kg || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h2>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Upstream freight & raw material sourcing
                      </span>
                    </div>
                  </div>

                  {/* Category Breakdown list */}
                  <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Category Breakdown Items
                  </h5>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {selectedLog.postPredictionModel?.breakdown && selectedLog.postPredictionModel.breakdown.length > 0 ? (
                      selectedLog.postPredictionModel.breakdown.map((item, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            {getActivityIcon(item.activityType)}
                            <span style={{ textTransform: 'capitalize' }}>{item.activityType}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 700 }}>{(item.kg / 1000).toFixed(2)} t</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({item.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No category breakdown records saved.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 32px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionHistory;
