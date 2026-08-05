import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  Cell
} from 'recharts';
import { Sliders, HelpCircle, ArrowRight, Activity, TrendingDown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CalculationResult {
  _id: string;
  period: string;
  totalKg: number;
}

const WhatIfSimulator: React.FC = () => {
  const { token, showToast } = useAuth();
  
  // Selection
  const [periods, setPeriods] = useState<CalculationResult[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState('');
  
  // Sliders
  const [roadRailShift, setRoadRailShift] = useState(0);
  const [renewableShare, setRenewableShare] = useState(0);
  const [supplierSwap, setSupplierSwap] = useState(0);
  
  // Simulation results
  const [simResults, setSimResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseTotalKg, setBaseTotalKg] = useState(0);

  // Fetch available calculation periods
  useEffect(() => {
    const fetchPeriods = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API_URL}/dashboard/trend`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const trends = res.data.trends || [];
        setPeriods(trends);
        if (trends.length > 0) {
          // Default select the latest period
          const latest = trends[trends.length - 1];
          setSelectedCalcId(latest._id);
          setBaseTotalKg(latest.totalKg);
        }
      } catch (err) {
        showToast('Failed to load calculation history', 'error');
      }
    };
    fetchPeriods();
  }, [token]);

  // Run simulation
  const runSimulation = async () => {
    if (!selectedCalcId || !token) return;
    setLoading(true);
    try {
      const changes = [];
      if (roadRailShift > 0) {
        changes.push({
          activityType: 'roadTransport',
          adjustmentType: 'shift_to_rail',
          adjustmentPct: roadRailShift
        });
      }
      if (renewableShare > 0) {
        changes.push({
          activityType: 'electricity',
          adjustmentType: 'renewable_share',
          adjustmentPct: renewableShare
        });
      }
      if (supplierSwap > 0) {
        changes.push({
          activityType: 'rawMaterial',
          adjustmentType: 'supplier_swap',
          adjustmentPct: supplierSwap
        });
      }

      const res = await axios.post(`${API_URL}/simulator/whatif`, {
        baseCalculationResultId: selectedCalcId,
        changes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSimResults(res.data);
    } catch (err) {
      showToast('Simulation calculation error', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate whenever inputs change
  useEffect(() => {
    if (selectedCalcId) {
      // Find selected base total
      const selected = periods.find(p => p._id === selectedCalcId);
      if (selected) setBaseTotalKg(selected.totalKg);
      
      const delayDebounce = setTimeout(() => {
        runSimulation();
      }, 350); // Debounce slide requests
      return () => clearTimeout(delayDebounce);
    }
  }, [selectedCalcId, roadRailShift, renewableShare, supplierSwap]);

  const getChartData = () => {
    const baselineT = baseTotalKg / 1000;
    const projectedT = simResults ? simResults.scenario.projectedTotalKg / 1000 : baselineT;
    
    return [
      { name: 'Emissions (t CO2e)', Baseline: parseFloat(baselineT.toFixed(2)), Projected: parseFloat(projectedT.toFixed(2)) }
    ];
  };

  const getSavingsValue = () => {
    if (!simResults) return 0;
    return simResults.scenario.savingsKg;
  };

  return (
    <div>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Supply Chain Simulator</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Model carbon reduction strategies and calculate dynamic projected savings in real-time</p>
      </header>

      {periods.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <HelpCircle size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>No Calculation Scopes Active</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
            Please navigate to the Data Entry section and log operational activities first. Once calculations exist, simulator projections will activate.
          </p>
        </div>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '32px' }}>
          {/* Sliders Control Panel */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={20} color="var(--primary)" />
              <span>Intervention Strategies</span>
            </h3>

            {/* Base Period selector */}
            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label">Simulation Base Period</label>
              <select 
                className="form-input" 
                value={selectedCalcId}
                onChange={(e) => setSelectedCalcId(e.target.value)}
              >
                {periods.map(p => (
                  <option key={p._id} value={p._id}>Period: {p.period} (Baseline: {(p.totalKg/1000).toFixed(1)} t CO2e)</option>
                ))}
              </select>
            </div>

            {/* Slider 1 */}
            <div className="slider-container">
              <div className="slider-header">
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Shift Road Freight to Rail</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{roadRailShift}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                className="custom-range"
                value={roadRailShift}
                onChange={(e) => setRoadRailShift(parseInt(e.target.value))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Replaces heavy road freight logistics with lower emission rail tracks (cuts transport emissions).
              </span>
            </div>

            {/* Slider 2 */}
            <div className="slider-container">
              <div className="slider-header">
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Renewable Energy Grid Share</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{renewableShare}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                className="custom-range"
                value={renewableShare}
                onChange={(e) => setRenewableShare(parseInt(e.target.value))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Transitions purchased grid electricity to green renewable contract supply.
              </span>
            </div>

            {/* Slider 3 */}
            <div className="slider-container" style={{ marginBottom: 0 }}>
              <div className="slider-header">
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Supplier Environmental Offset</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{supplierSwap}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                className="custom-range"
                value={supplierSwap}
                onChange={(e) => setSupplierSwap(parseInt(e.target.value))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Swaps high-intensity suppliers for green/organic partners (reduces raw material footprint).
              </span>
            </div>
          </div>

          {/* Results Comparison and Graph */}
          <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingDown size={20} color="var(--primary)" />
                <span>Projected Impact Analysis</span>
              </h3>

              {/* Savings metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Projected Reduction</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
                    {(getSavingsValue() / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
                  </h2>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    ({getSavingsValue().toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e saved)
                  </span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Projected Total</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
                    {((baseTotalKg - getSavingsValue()) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>t CO2e</span>
                  </h2>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    After applying selected interventions
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div style={{ height: '220px', width: '100%' }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Simulating changes...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartData()} barGap={12}>
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="Baseline" fill="rgba(255,255,255,0.2)">
                        <Cell fill="rgba(255, 255, 255, 0.2)" />
                      </Bar>
                      <Bar dataKey="Projected" fill="var(--primary)">
                        <Cell fill="var(--primary)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quick insights tip */}
            <div style={{ 
              marginTop: '24px', 
              background: 'rgba(16, 185, 129, 0.04)', 
              borderLeft: '3px solid var(--primary)', 
              padding: '16px', 
              borderRadius: '0 8px 8px 0',
              fontSize: '12.5px',
              lineHeight: '18px',
              color: 'var(--text-muted)'
            }}>
              <b>Intervention Audit:</b> A 30% road transport shift to rail reduces freight emissions by exactly 30% for that line-item. Apply sliders concurrently to view cumulative supply chain offsets.
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default WhatIfSimulator;
