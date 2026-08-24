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
  FileText, 
  Download, 
  Clock, 
  FileCheck,
  AlertTriangle,
  HelpCircle,
  Eye,
  X,
  PieChart as PieIcon,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  Database,
  BarChart2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ReportRecord {
  _id: string;
  period: string;
  format: 'BRSR' | 'CSRD';
  fileName: string;
  generatedAt: string;
}

interface ReportAnalyticsData {
  period: string;
  format: string;
  calculationResult: {
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
  trends: Array<{ period: string; totalKg: number }>;
}

const ReportsArchive: React.FC = () => {
  const { token, showToast } = useAuth();

  // Generator form
  const [period, setPeriod] = useState('2022-12');
  const [format, setFormat] = useState<'BRSR' | 'CSRD'>('BRSR');
  const [generating, setGenerating] = useState(false);

  // Archive history list
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Analytic View Modal State
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [analyticsData, setAnalyticsData] = useState<ReportAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Fetch reports list
  const fetchReports = async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_URL}/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(res.data.reports || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading reports archive', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  // Handle PDF report generation & automatic Analytic Preview trigger
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    showToast('Compiling sustainability metrics and generating charts...', 'warning');

    try {
      const res = await axios.post(`${API_URL}/reports`, {
        period,
        format
      }, {
        headers: { 
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob' // Binary PDF stream
      });

      // Download file client-side
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${format}_Report_${period}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`${format} compliance PDF generated successfully!`, 'success');
      
      // Refresh list to update history archive
      await fetchReports();

      // Automatically open Analytic View for the newly generated report!
      openAnalyticView({
        _id: 'new',
        period,
        format,
        fileName: `${format}_Report_${period}.pdf`,
        generatedAt: new Date().toISOString()
      });

    } catch (err: any) {
      console.error(err);
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          showToast(json.detail || 'Error generating report', 'error');
          return;
        } catch (_) {}
      }
      showToast('No emission calculations exist for the selected period.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Download historical report file
  const handleDownloadHistorical = async (reportId: string, reportFormat: string, reportPeriod: string) => {
    try {
      showToast('Downloading document...', 'warning');
      const res = await axios.get(`${API_URL}/reports/download/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportFormat}_Report_${reportPeriod}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Download complete', 'success');
    } catch (err) {
      showToast('Error downloading report file', 'error');
    }
  };

  // Open Analytic View Modal
  const openAnalyticView = async (report: ReportRecord) => {
    setSelectedReport(report);
    setLoadingAnalytics(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const summaryRes = await axios.get(`${API_URL}/dashboard/summary`, {
        headers,
        params: { period: report.period }
      });
      const trendRes = await axios.get(`${API_URL}/dashboard/trend`, { headers });

      setAnalyticsData({
        period: report.period,
        format: report.format,
        calculationResult: summaryRes.data.calculationResult,
        explainabilityResult: summaryRes.data.explainabilityResult || { topFactors: [] },
        trends: trendRes.data.trends || []
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to load analytic summary', 'error');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Regulatory Compliance Reporting</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Compile emission records into audit-inspired disclosure summaries matching BRSR or CSRD guidelines
        </p>
      </header>

      <section className="two-col-layout">
        {/* Document Generator Form */}
        <div className="glass-panel" style={{ padding: '32px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck size={20} color="var(--primary)" />
            <span>Generate Compliance Document</span>
          </h3>

          <form onSubmit={handleGenerateReport}>
            <div className="form-group">
              <label className="form-label">Target Period</label>
              <input 
                type="month" 
                className="form-input" 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label">Disclosure Standard / Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: format === 'BRSR' ? 'var(--primary)' : 'var(--border-color)',
                  background: format === 'BRSR' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input 
                    type="radio" 
                    name="format" 
                    value="BRSR" 
                    checked={format === 'BRSR'} 
                    onChange={() => setFormat('BRSR')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 600 }}>SEBI BRSR</h5>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>India ESG Standard</span>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: format === 'CSRD' ? 'var(--primary)' : 'var(--border-color)',
                  background: format === 'CSRD' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input 
                    type="radio" 
                    name="format" 
                    value="CSRD" 
                    checked={format === 'CSRD'} 
                    onChange={() => setFormat('CSRD')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 600 }}>EU CSRD</h5>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>European Directive</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Compliance warning */}
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
              color: 'var(--warning)',
              fontSize: '12px',
              lineHeight: '16px',
              marginBottom: '24px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                Generated reports are draft summaries inspired by sustainability metrics and are <b>not certified compliance filings</b>.
              </span>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              disabled={generating}
            >
              {generating ? 'Compiling PDF & Analytics...' : 'Compile & Download PDF Report'}
            </button>
          </form>
        </div>

        {/* Historical Archive List */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--primary)" />
            <span>Document Log Archive</span>
          </h3>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading history...</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              <HelpCircle size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <h4 style={{ fontSize: '14px', fontWeight: 600 }}>No Reports Generated Yet</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Fill in target period activities above and click Compile to generate reports.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
              {reports.map(report => (
                <div 
                  key={report._id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    transition: 'border-color 0.2s'
                  }}
                  className="report-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '8px', 
                      background: 'rgba(16, 185, 129, 0.08)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <FileText color="var(--primary)" size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                        {report.format} Report — Period {report.period}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Generated: {new Date(report.generatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => openAnalyticView(report)}
                      className="btn btn-secondary" 
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                      title="Analytic View"
                    >
                      <BarChart2 size={14} color="var(--primary)" />
                      <span>Analytic View</span>
                    </button>

                    <button 
                      onClick={() => handleDownloadHistorical(report._id, report.format, report.period)}
                      className="btn btn-primary" 
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                      title="Download PDF"
                    >
                      <Download size={14} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive Report Analytic View Modal */}
      {selectedReport && (
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
            width: '920px',
            maxHeight: '92vh',
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
                  <BarChart2 color="var(--primary)" size={24} />
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                    {selectedReport.format} Disclosure Analytic View — Period {selectedReport.period}
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Interactive compliance analytics preview and machine-learning diagnostics
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => handleDownloadHistorical(selectedReport._id, selectedReport.format, selectedReport.period)}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>

                <button 
                  onClick={() => setSelectedReport(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
              {loadingAnalytics ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16, 185, 129, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : !analyticsData?.calculationResult ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No calculation metrics recorded for period {selectedReport.period}.
                </div>
              ) : (
                <div>
                  {/* Inventory Summary Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 700 }}>Scope 1 Direct</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px', color: '#3b82f6', margin: 0 }}>
                        {(analyticsData.calculationResult.scope1Kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h3>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Direct Fuel Combustion</span>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase', fontWeight: 700 }}>Scope 2 Energy</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px', color: '#10b981', margin: 0 }}>
                        {(analyticsData.calculationResult.scope2Kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h3>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Purchased Grid Electricity</span>
                    </div>

                    <div style={{ background: 'rgba(139, 92, 246, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                      <span style={{ fontSize: '11px', color: '#8b5cf6', textTransform: 'uppercase', fontWeight: 700 }}>Scope 3 Supply Chain</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px', color: '#8b5cf6', margin: 0 }}>
                        {(analyticsData.calculationResult.scope3Kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h3>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Upstream Value Chain</span>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--primary)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700 }}>Total Footprint</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px', color: 'var(--primary)', margin: 0 }}>
                        {(analyticsData.calculationResult.totalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </h3>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ML Model Corrected Sum</span>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
                    {/* Category Breakdown Pie Chart */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieIcon size={16} color="var(--primary)" />
                        <span>Category Breakdown</span>
                      </h4>

                      <div style={{ height: '180px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '50%', height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analyticsData.calculationResult.breakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={4}
                                dataKey="kg"
                                nameKey="activityType"
                              >
                                {analyticsData.calculationResult.breakdown.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Emissions']}
                                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div style={{ width: '50%', paddingLeft: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {analyticsData.calculationResult.breakdown.map((item, idx) => (
                              <div key={item.activityType} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                <span style={{ fontSize: '11px', textTransform: 'capitalize', fontWeight: 600 }}>{item.activityType}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.pct.toFixed(1)}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Historical Trend Line */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={16} color="var(--primary)" />
                        <span>Multi-Period Historical Trend</span>
                      </h4>

                      <div style={{ height: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsData.trends} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                            <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}t`} />
                            <Tooltip
                              formatter={(value: any) => [`${(Number(value)/1000).toFixed(2)} t CO2e`, 'Emissions']}
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Line type="monotone" dataKey="totalKg" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* SHAP Diagnostics */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lightbulb size={16} color="var(--primary)" />
                      <span>Machine Learning SHAP Feature Allocations</span>
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {analyticsData.explainabilityResult?.topFactors && analyticsData.explainabilityResult.topFactors.length > 0 ? (
                        analyticsData.explainabilityResult.topFactors.map((factor, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'capitalize' }}>{factor.feature}</span>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{factor.plainLanguage}</p>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px', flexShrink: 0 }}>
                              {factor.contributionPct.toFixed(1)}% weight
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Standard static factor calculations applied for period {selectedReport.period}.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 32px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Verification Ref: CF-{selectedReport.period}-{selectedReport.format}
              </span>

              <button 
                onClick={() => handleDownloadHistorical(selectedReport._id, selectedReport.format, selectedReport.period)}
                className="btn btn-primary" 
                style={{ padding: '10px 20px', fontSize: '13px' }}
              >
                <Download size={15} />
                <span>Download Official PDF Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsArchive;
