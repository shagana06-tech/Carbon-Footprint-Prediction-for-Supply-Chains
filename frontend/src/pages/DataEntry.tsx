import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, Building2, Calendar,
  CheckCircle2, ArrowRight, ArrowLeft, Loader2,
  AlertCircle, FileCheck, Zap, TrendingUp,
  BarChart3, FileText
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type ActivityType = 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
type DisclosureFormat = 'BRSR' | 'CSRD';

interface ParsedRow {
  period: string;
  activityType: ActivityType;
  quantity: number;
  unit: string;
  region: string;
  equipmentAgeYears?: number;
  cargoWeightTons?: number;
  supplierId?: string;
}

// ─── Smart column resolver ────────────────────────────────────────────────────
// ─── Smart column resolver ────────────────────────────────────────────────────
const findCol = (headers: string[], aliases: string[]): string | undefined =>
  headers.find(h => {
    const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return aliases.some(a => {
      const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanH === cleanA || cleanH.includes(cleanA);
    });
  });

// Maps any common label to a canonical ActivityType
const normalizeActivityType = (val: string): ActivityType => {
  const v = (val ?? '').toLowerCase().trim();
  if (v.includes('electric') || v.includes('ev') || v.includes('bev') || v.includes('phev') || v.includes('grid') || v.includes('power') || v.includes('battery') || v.includes('kwh')) return 'electricity';
  if (v.includes('diesel') || v.includes('ice') || v.includes('petrol') || v.includes('gasoline') || v.includes('fuel') || v.includes('combustion')) return 'diesel';
  if (v.includes('road') || v.includes('transport') || v.includes('freight') || v.includes('logistic') || v.includes('truck') || v.includes('vehicle') || v.includes('drive')) return 'roadTransport';
  if (v.includes('raw') || v.includes('material') || v.includes('weight') || v.includes('capacity') || v.includes('cotton') || v.includes('steel') || v.includes('spec')) return 'rawMaterial';
  return 'electricity'; // safe default
};

const defaultUnit = (t: ActivityType) =>
  ({ electricity: 'kWh', diesel: 'litre', roadTransport: 'km', rawMaterial: 'kg' }[t]);

// Convert SheetJS JSON rows → typed ParsedRow[]
const sheetToRows = (jsonRows: any[], defaultPeriod: string): ParsedRow[] => {
  if (!jsonRows.length) return [];
  const headers = Object.keys(jsonRows[0]);

  const pCol   = findCol(headers, ['period', 'month', 'date', 'year', 'model_year', 'modelyear', 'fy', 'fiscalyear', 'time']);
  const tCol   = findCol(headers, ['activitytype', 'activity', 'type', 'category', 'fuel', 'fueltype', 'drivetrain', 'powertrain', 'vehicle', 'vehicletype', 'engine']);
  let qCol     = findCol(headers, ['quantity', 'qty', 'amount', 'value', 'volume', 'count', 'capacity', 'batterycapacity', 'range', 'sales', 'units', 'weight', 'curbweight', 'grossweight', 'distance', 'mileage', 'consumption', 'efficiency', 'emissions', 'co2emissions', 'power', 'horsepower']);
  const uCol   = findCol(headers, ['unit', 'units', 'measure', 'measurement']);
  const rCol   = findCol(headers, ['region', 'location', 'country', 'area', 'market', 'state']);
  const ageCol = findCol(headers, ['equipmentageyears', 'equipmentage', 'age', 'vehicleage', 'modelage', 'year']);
  const cCol   = findCol(headers, ['cargoweighttons', 'cargoweight', 'cargo', 'weight', 'grossweight', 'payload']);
  const sCol   = findCol(headers, ['supplierid', 'supplier', 'make', 'brand', 'vendor', 'manufacturer', 'model']);

  // Dynamic Numeric Fallback: If no explicit quantity column matched by header name, find the first numeric column in jsonRows with positive values
  if (!qCol) {
    qCol = headers.find(h => {
      let positiveNumericCount = 0;
      for (let i = 0; i < Math.min(30, jsonRows.length); i++) {
        const valStr = String(jsonRows[i][h] ?? '').replace(/[^0-9.-]/g, '');
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0) positiveNumericCount++;
      }
      return positiveNumericCount >= Math.min(5, Math.ceil(jsonRows.length * 0.2));
    });
  }

  const rows: ParsedRow[] = [];
  for (const row of jsonRows) {
    const rawValStr = qCol ? String(row[qCol] ?? '').replace(/[^0-9.-]/g, '') : '';
    let rawQty = parseFloat(rawValStr);

    // Row-level numeric extraction fallback
    if (isNaN(rawQty) || rawQty <= 0) {
      for (const h of headers) {
        if (h === pCol) continue;
        const v = parseFloat(String(row[h] ?? '').replace(/[^0-9.-]/g, ''));
        if (!isNaN(v) && v > 0) {
          rawQty = v;
          break;
        }
      }
    }

    if (isNaN(rawQty) || rawQty <= 0) continue;

    const actType = tCol ? normalizeActivityType(String(row[tCol])) : 'electricity';
    const cargoStr = cCol ? String(row[cCol] ?? '').replace(/[^0-9.-]/g, '') : '';
    const cargo    = parseFloat(cargoStr);

    let rawPeriod = pCol ? String(row[pCol]).trim() : defaultPeriod;
    if (/^\d{4}$/.test(rawPeriod)) {
      rawPeriod = `${rawPeriod}-12`;
    }

    rows.push({
      period:            rawPeriod || defaultPeriod,
      activityType:      actType,
      quantity:          rawQty,
      unit:              uCol ? (String(row[uCol]).trim() || defaultUnit(actType)) : defaultUnit(actType),
      region:            rCol ? (String(row[rCol]).trim() || 'India') : 'India',
      equipmentAgeYears: ageCol ? (parseInt(String(row[ageCol]).replace(/[^0-9]/g, '')) || 5) : 5,
      cargoWeightTons:   actType === 'roadTransport'
                           ? (!isNaN(cargo) && cargo > 0 ? cargo : 1)
                           : undefined,
      supplierId:        sCol ? (String(row[sCol]).trim() || undefined) : undefined,
    });
  }
  return rows;
};

// ─── Visual helpers ───────────────────────────────────────────────────────────
const ACTIVITY_COLORS: Record<ActivityType, string> = {
  electricity: '#10b981',
  diesel: '#3b82f6',
  roadTransport: '#f59e0b',
  rawMaterial: '#8b5cf6',
};
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  electricity: 'Electricity',
  diesel: 'Diesel',
  roadTransport: 'Road Transport',
  rawMaterial: 'Raw Material',
};

// ─── Component ────────────────────────────────────────────────────────────────
const DataEntry: React.FC = () => {
  const { token, showToast } = useAuth();
  const navigate = useNavigate();

  // Wizard step: 1 = details, 2 = upload, 3 = success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [companyName, setCompanyName]       = useState('');
  const [period, setPeriod]                 = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [disclosureFormat, setDisclosureFormat] = useState<DisclosureFormat>('BRSR');

  // Step 2 state
  const [file, setFile]           = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse file (CSV or Excel) ──
  const parseFile = useCallback((f: File) => {
    setFile(f);
    setParsedRows([]);
    setParseError('');

    const handleJson = (json: any[]) => {
      const rows = sheetToRows(json, period);
      if (rows.length === 0) {
        setParseError('No valid rows found. Ensure your file has a quantity column with numeric values > 0.');
      } else {
        setParsedRows(rows);
        showToast(`Parsed ${rows.length} valid records from "${f.name}"`, 'success');
      }
    };

    const reader = new FileReader();

    if (f.name.endsWith('.csv')) {
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result as string, { type: 'string' });
        handleJson(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
      };
      reader.readAsText(f);
    } else {
      // .xlsx / .xls
      reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        handleJson(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
      };
      reader.readAsArrayBuffer(f);
    }
  }, [period]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(csv|xlsx|xls)$/i.test(f.name)) {
      parseFile(f);
    } else {
      setParseError('Only .csv and .xlsx/.xls files are supported.');
    }
  }, [parseFile]);

  // ── Bulk upload ──
  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    try {
      await axios.post(
        `${API_URL}/activity-entries/bulk`,
        { entries: parsedRows },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStep(3);
      showToast(`${parsedRows.length} records uploaded! Calculating emissions…`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Upload failed. Please check your data and try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Aggregate type counts for preview
  const typeCounts = parsedRows.reduce((acc, r) => {
    acc[r.activityType] = (acc[r.activityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>
          {step === 1 && 'Company & Report Setup'}
          {step === 2 && 'Upload Emissions Data'}
          {step === 3 && 'Upload Complete!'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
          {step === 1 && 'Set your company name, reporting period and disclosure standard — takes 30 seconds'}
          {step === 2 && 'Drag & drop a CSV or Excel file. We auto-detect columns and apply smart defaults.'}
          {step === 3 && 'Your data is being processed. Head to the Dashboard to see ML-corrected predictions.'}
        </p>
      </header>

      {/* Step Progress Bar */}
      {step < 3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '32px', maxWidth: '420px' }}>
          {/* Step 1 circle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
              background: step >= 1 ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff',
              boxShadow: step === 1 ? '0 0 0 4px rgba(16,185,129,0.2)' : 'none',
              transition: 'all 0.3s',
            }}>
              {step > 1 ? <CheckCircle2 size={16} /> : '1'}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: step >= 1 ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Company Details
            </span>
          </div>

          {/* Connector */}
          <div style={{ flex: 1, height: '2px', margin: '0 12px', background: step > 1 ? 'var(--primary)' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />

          {/* Step 2 circle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
              background: step >= 2 ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: step >= 2 ? '#fff' : 'var(--text-muted)',
              boxShadow: step === 2 ? '0 0 0 4px rgba(16,185,129,0.2)' : 'none',
              transition: 'all 0.3s',
            }}>
              2
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: step >= 2 ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Upload File
            </span>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 1 ══════════════ */}
      {step === 1 && (
        <div style={{ maxWidth: '580px' }}>
          <div className="glass-panel" style={{ padding: '40px' }}>
            {/* Card heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 color="var(--primary)" size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Company & Reporting Details</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '3px 0 0 0' }}>Only the period is required — everything else is optional</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

              {/* Company Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Company / Organisation Name
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400, marginLeft: '6px' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Manufacturing Ltd."
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
              </div>

              {/* Reporting Period */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Reporting Period <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={15} color="var(--primary)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="month"
                    className="form-input"
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    style={{ paddingLeft: '42px' }}
                    required
                  />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
                  Used as the default period for all uploaded rows (overridable per-row inside the file).
                </p>
              </div>

              {/* Disclosure Standard */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Disclosure Standard</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {(['BRSR', 'CSRD'] as DisclosureFormat[]).map(fmt => (
                    <label key={fmt} onClick={() => setDisclosureFormat(fmt)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 16px', borderRadius: '10px', border: '1px solid',
                      borderColor: disclosureFormat === fmt ? 'var(--primary)' : 'var(--border-color)',
                      background: disclosureFormat === fmt ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}>
                      <input
                        type="radio" name="discFmt" value={fmt}
                        checked={disclosureFormat === fmt}
                        onChange={() => setDisclosureFormat(fmt)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>
                          {fmt === 'BRSR' ? 'SEBI BRSR' : 'EU CSRD'}
                        </h5>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {fmt === 'BRSR' ? 'India ESG Standard' : 'European Directive'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Continue button */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '32px', padding: '14px', fontSize: '15px' }}
              onClick={() => setStep(2)}
              disabled={!period}
            >
              Continue to File Upload
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 2 ══════════════ */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Left — Drop zone */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Upload Emissions File</h3>
              <span style={{ fontSize: '11px', color: 'var(--primary)', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                Period: {period}
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary)' : file ? 'rgba(16,185,129,0.5)' : 'var(--border-color)'}`,
                borderRadius: '16px',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(16,185,129,0.04)' : file ? 'rgba(16,185,129,0.02)' : 'rgba(15,23,42,0.4)',
                transition: 'all 0.25s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
              />

              {file ? (
                <>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <FileCheck size={28} color="var(--primary)" />
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '15px', margin: '0 0 4px 0', wordBreak: 'break-all' }}>{file.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    {(file.size / 1024).toFixed(1)} KB · Click to replace
                  </p>
                </>
              ) : (
                <>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Upload size={28} color="var(--text-muted)" />
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 6px 0' }}>Drag & drop your file here</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>or click to browse files</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {['.CSV', '.XLSX', '.XLS'].map(ext => (
                      <span key={ext} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '20px' }}>{ext}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Parse error */}
            {parseError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)', fontSize: '12px', lineHeight: '18px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                {parseError}
              </div>
            )}

            {/* Supported columns reference */}
            <div style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
                Recognised Column Names
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                {['activityType', 'quantity', 'unit', 'region', 'period', 'equipmentAgeYears', 'cargoWeightTons', 'supplierId'].map(col => (
                  <code key={col} style={{ fontSize: '10px', background: 'rgba(16,185,129,0.08)', color: 'var(--primary)', padding: '2px 7px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.15)' }}>{col}</code>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '16px' }}>
                Common aliases (Type, Qty, Region, etc.) are auto-detected. Missing optional fields use smart defaults (Region → India, Equipment Age → 5 yrs).
              </p>
            </div>

            {/* Activity type value guide */}
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>Activity Type Values</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(ACTIVITY_LABELS).map(([type, label]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: ACTIVITY_COLORS[type as ActivityType], flexShrink: 0 }} />
                    <code style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{type}</code>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>→ {label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Preview & Confirm */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {parsedRows.length > 0 ? (
              <>
                {/* Parse Summary */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={16} color="var(--primary)" />
                    Parse Summary
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', padding: '16px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div style={{ fontSize: '30px', fontWeight: 800 }} className="text-gradient">{parsedRows.length.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Valid Rows</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '30px', fontWeight: 800 }}>{Object.keys(typeCounts).length}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Activity Types</div>
                    </div>
                  </div>

                  {/* Type breakdown pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: ACTIVITY_COLORS[type as ActivityType] }} />
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{ACTIVITY_LABELS[type as ActivityType] || type}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: ACTIVITY_COLORS[type as ActivityType] }}>
                          {(count as number).toLocaleString()} rows
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row Preview Table */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 14px 0' }}>
                    Data Preview <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>(first 5 rows)</span>
                  </h4>
                  <div style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <tr>
                          {['Period', 'Type', 'Quantity', 'Unit', 'Region'].map(h => (
                            <th key={h} style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((row, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{row.period}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ color: ACTIVITY_COLORS[row.activityType], fontWeight: 700, fontSize: '10px', background: `${ACTIVITY_COLORS[row.activityType]}18`, padding: '2px 7px', borderRadius: '10px' }}>
                                {ACTIVITY_LABELS[row.activityType]}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{row.quantity.toLocaleString()}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{row.unit}</td>
                            <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{row.region}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedRows.length > 5 && (
                      <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        + {(parsedRows.length - 5).toLocaleString()} more rows…
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Empty state placeholder */
              <div className="glass-panel" style={{ padding: '48px 32px', textAlign: 'center' }}>
                <FileSpreadsheet size={52} color="var(--text-muted)" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }} />
                <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>No file selected</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '20px' }}>
                  Upload a CSV or Excel file on the left.<br />A row summary and preview will appear here.
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '14px', opacity: parsedRows.length === 0 ? 0.5 : 1 }}
                disabled={parsedRows.length === 0 || uploading}
                onClick={handleUpload}
              >
                {uploading ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
                ) : (
                  <><Zap size={18} /> Upload & Generate Analysis</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 3 — SUCCESS ══════════════ */}
      {step === 3 && (
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '56px 40px' }}>

            {/* Animated success ring */}
            <div style={{
              width: '88px', height: '88px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.1)',
              border: '2px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
              boxShadow: '0 0 32px rgba(16,185,129,0.15)'
            }}>
              <CheckCircle2 size={46} color="var(--primary)" />
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '14px' }} className="text-gradient">
              Data Uploaded Successfully!
            </h2>

            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '24px', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--text-main)' }}>{parsedRows.length.toLocaleString()} emission records</strong> ingested for period <strong style={{ color: 'var(--primary)' }}>{period}</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '22px', marginBottom: '36px' }}>
              The system is calculating Scope 1/2/3 baselines and applying XGBoost ML correction. SHAP explainability insights will appear on the Dashboard.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '15px' }}
                onClick={() => navigate('/')}
              >
                <TrendingUp size={20} />
                View Dashboard & Predictions
              </button>

              <button
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => navigate('/reports')}
              >
                <FileText size={16} />
                Generate Compliance Report ({disclosureFormat})
              </button>

              <button
                onClick={() => { setStep(1); setFile(null); setParsedRows([]); setParseError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '10px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Upload another file
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DataEntry;
