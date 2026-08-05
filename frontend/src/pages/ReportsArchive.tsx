import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { 
  FileText, 
  Download, 
  Clock, 
  FileCheck,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ReportRecord {
  _id: string;
  period: string;
  format: 'BRSR' | 'CSRD';
  fileName: string;
  generatedAt: string;
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

  // Handle PDF report generation
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
        responseType: 'blob' // Essential to handle binary PDF stream
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
      fetchReports();
    } catch (err: any) {
      console.error(err);
      // Read blob error message if JSON
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

  return (
    <div>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Regulatory Compliance Reporting</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Compile emission records into audit-inspired disclosure summaries matching BRSR or CSRD guidelines</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '32px' }}>
        {/* Document Generator Form */}
        <div className="glass-panel" style={{ padding: '32px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck size={20} color="var(--primary)" />
            <span>Generate Document</span>
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
              {generating ? 'Compiling PDF...' : 'Compile & Download PDF'}
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
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Fill in period activities and trigger report compilation above.</p>
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

                  <button 
                    onClick={() => handleDownloadHistorical(report._id, report.format, report.period)}
                    className="btn btn-secondary" 
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                    title="Download Report"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ReportsArchive;
