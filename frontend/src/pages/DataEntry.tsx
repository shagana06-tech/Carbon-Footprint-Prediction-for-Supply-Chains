import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { 
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  FileText,
  AlertCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ActivityEntry {
  _id: string;
  period: string;
  activityType: 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
  quantity: number;
  unit: string;
  region: string;
  equipmentAgeYears?: number;
  cargoWeightTons?: number;
  supplierId?: string;
  createdAt: string;
}

const DataEntry: React.FC = () => {
  const { token, showToast } = useAuth();

  // Manual Form State
  const [period, setPeriod] = useState('2022-12');
  const [activityType, setActivityType] = useState<'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial'>('electricity');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kWh');
  const [region, setRegion] = useState('India');
  const [equipmentAge, setEquipmentAge] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [supplierId, setSupplierId] = useState('');

  // Bulk Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Table Data State
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  // Map Default Units when Activity Type changes
  useEffect(() => {
    switch (activityType) {
      case 'electricity':
        setUnit('kWh');
        setRegion('India');
        break;
      case 'diesel':
        setUnit('litre');
        setRegion('Global');
        break;
      case 'roadTransport':
        setUnit('km');
        setRegion('Global');
        break;
      case 'rawMaterial':
        setUnit('kg');
        setRegion('Global');
        break;
    }
  }, [activityType]);

  // Fetch entries
  const fetchEntries = async () => {
    if (!token) return;
    setLoadingTable(true);
    try {
      const res = await axios.get(`${API_URL}/activity-entries`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 10, period: filterPeriod || undefined }
      });
      setEntries(res.data.entries);
      setTotalPages(res.data.pagination.pages || 1);
    } catch (err) {
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [page, filterPeriod, token]);

  // Handle Manual submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || parseFloat(quantity) <= 0) {
      showToast('Quantity must be greater than zero', 'warning');
      return;
    }

    if (activityType === 'roadTransport' && (!cargoWeight || parseFloat(cargoWeight) <= 0)) {
      showToast('Cargo weight in tons is required for road freight calculations', 'warning');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/activity-entries`, {
        period,
        activityType,
        quantity: parseFloat(quantity),
        unit,
        region,
        equipmentAgeYears: equipmentAge ? parseInt(equipmentAge) : undefined,
        cargoWeightTons: cargoWeight ? parseFloat(cargoWeight) : undefined,
        supplierId: supplierId || undefined
      }, { headers });

      showToast('Activity entry recorded successfully!', 'success');
      // Reset inputs
      setQuantity('');
      setEquipmentAge('');
      setCargoWeight('');
      setSupplierId('');
      
      // Refresh list
      setPage(1);
      fetchEntries();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Error saving entry', 'error');
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this activity entry?')) return;

    try {
      await axios.delete(`${API_URL}/activity-entries/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Log entry removed', 'success');
      fetchEntries();
    } catch (err) {
      showToast('Error deleting entry', 'error');
    }
  };

  // Client Side CSV parsing
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/);
      
      if (lines.length < 2) {
        showToast('Invalid CSV. Missing header or records.', 'error');
        return;
      }

      // Headers: period,activityType,quantity,unit,region,equipmentAgeYears,cargoWeightTons,supplierId
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx];
        });
        
        rows.push({
          period: obj.period,
          activityType: obj.activityType,
          quantity: parseFloat(obj.quantity),
          unit: obj.unit,
          region: obj.region,
          equipmentAgeYears: obj.equipmentAgeYears ? parseInt(obj.equipmentAgeYears) : undefined,
          cargoWeightTons: obj.cargoWeightTons ? parseFloat(obj.cargoWeightTons) : undefined,
          supplierId: obj.supplierId || undefined
        });
      }

      setParsedRows(rows);
      showToast(`Parsed ${rows.length} records. Please review before uploading.`, 'success');
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    try {
      await axios.post(`${API_URL}/activity-entries/bulk`, {
        entries: parsedRows
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(`Successfully uploaded ${parsedRows.length} activities`, 'success');
      setCsvFile(null);
      setParsedRows([]);
      setPage(1);
      fetchEntries();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'CSV upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Supply Chain Data Collection</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Log operational metrics manually or upload bulk CSV files for processing</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '32px', marginBottom: '32px' }}>
        {/* Manual Form */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Plus size={20} color="var(--primary)" />
            <span>Manual Activity Log</span>
          </h3>

          <form onSubmit={handleManualSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Period</label>
                <input 
                  type="month" 
                  className="form-input" 
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Activity Type</label>
                <select 
                  className="form-input" 
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as any)}
                >
                  <option value="electricity">Electricity Grid</option>
                  <option value="diesel">Diesel Fuel</option>
                  <option value="roadTransport">Road Freight Logistics</option>
                  <option value="rawMaterial">Raw Materials (Cotton)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input 
                  type="number" 
                  step="any"
                  className="form-input" 
                  placeholder="e.g. 5000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reporting Unit</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={unit}
                  readOnly
                  style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Operating Region</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="India"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Equipment Age (Years)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Optional (e.g. 8)"
                  value={equipmentAge}
                  onChange={(e) => setEquipmentAge(e.target.value)}
                />
              </div>
            </div>

            {activityType === 'roadTransport' && (
              <div className="form-group" style={{ borderLeft: '2px solid var(--primary)', paddingLeft: '16px' }}>
                <label className="form-label">Cargo Weight (Tons) <span style={{ color: 'var(--error)' }}>*</span></label>
                <input 
                  type="number" 
                  step="any"
                  className="form-input" 
                  placeholder="e.g. 5"
                  value={cargoWeight}
                  onChange={(e) => setCargoWeight(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Required for Ton-Kilometer (tkm) calculations.
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Supplier ID</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Optional (e.g. SUP-902)"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Create Activity Record
            </button>
          </form>
        </div>

        {/* CSV Bulk Upload */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Upload size={20} color="var(--primary)" />
              <span>Bulk CSV Ingestion</span>
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '18px', marginBottom: '24px' }}>
              Upload logs using a standardized template. CSV headers must match: <br />
              <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', display: 'block', margin: '8px 0', fontSize: '11px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                period,activityType,quantity,unit,region,equipmentAgeYears,cargoWeightTons,supplierId
              </code>
            </p>

            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.4)',
              transition: 'border-color 0.2s',
              position: 'relative'
            }} className="csv-drop-zone">
              <input 
                type="file" 
                accept=".csv"
                onChange={handleCsvChange}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
              <FileSpreadsheet size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500 }}>
                {csvFile ? csvFile.name : 'Select or drag your CSV file here'}
              </p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Files must end in .csv</span>
            </div>

            {/* Row Preview Table */}
            {parsedRows.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Ingestion Preview ({parsedRows.length} rows)</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '8px' }}>Period</th>
                        <th style={{ padding: '8px' }}>Type</th>
                        <th style={{ padding: '8px' }}>Qty</th>
                        <th style={{ padding: '8px' }}>Region</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px' }}>{row.period}</td>
                          <td style={{ padding: '8px', textTransform: 'capitalize' }}>{row.activityType}</td>
                          <td style={{ padding: '8px' }}>{row.quantity} {row.unit}</td>
                          <td style={{ padding: '8px' }}>{row.region}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 5 && (
                    <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      + {parsedRows.length - 5} more rows...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setCsvFile(null); setParsedRows([]); }} className="btn btn-secondary" style={{ flex: 1 }}>
                Clear
              </button>
              <button onClick={handleBulkUpload} className="btn btn-primary" style={{ flex: 2 }} disabled={uploading}>
                {uploading ? 'Processing...' : `Commit Ingestion`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Database log table */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Activity Ingestion Registry</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scoping logs stored on system ledger</p>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter by period:</span>
            <input 
              type="month" 
              value={filterPeriod}
              onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}
              className="form-input" 
              style={{ padding: '6px 12px', width: '160px', fontSize: '12px' }}
            />
            {filterPeriod && (
              <button 
                onClick={() => setFilterPeriod('')} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loadingTable ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <AlertCircle size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 600 }}>No Activity Entries Found</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Enter activity records or seed the demo to populate dashboard logs.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px' }}>Period</th>
                    <th style={{ padding: '16px' }}>Activity Type</th>
                    <th style={{ padding: '16px' }}>Quantity</th>
                    <th style={{ padding: '16px' }}>Region</th>
                    <th style={{ padding: '16px' }}>Equip. Age</th>
                    <th style={{ padding: '16px' }}>Cargo Weight</th>
                    <th style={{ padding: '16px' }}>Supplier ID</th>
                    <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row">
                      <td style={{ padding: '16px', fontWeight: 600 }}>{entry.period}</td>
                      <td style={{ padding: '16px', textTransform: 'capitalize' }}>{entry.activityType}</td>
                      <td style={{ padding: '16px' }}>{entry.quantity.toLocaleString()} {entry.unit}</td>
                      <td style={{ padding: '16px' }}>{entry.region}</td>
                      <td style={{ padding: '16px' }}>{entry.equipmentAgeYears !== undefined ? `${entry.equipmentAgeYears} yrs` : '—'}</td>
                      <td style={{ padding: '16px' }}>{entry.cargoWeightTons !== undefined ? `${entry.cargoWeightTons} t` : '—'}</td>
                      <td style={{ padding: '16px', color: 'var(--primary)', fontWeight: 500 }}>{entry.supplierId || '—'}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteEntry(entry._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="Delete Record"
                          className="delete-btn"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setPage(page - 1)} 
                    disabled={page === 1}
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setPage(page + 1)} 
                    disabled={page === totalPages}
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default DataEntry;
