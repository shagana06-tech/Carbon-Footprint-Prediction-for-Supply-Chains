import { Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Report } from '../models/report.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// ─── Network error helper ─────────────────────────────────────────────────────
function isNetworkError(err: any): boolean {
  return (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ERR_NETWORK' ||
    err.message === 'Network Error' ||
    !err.response
  );
}

// ─── Node-side PDF fallback ───────────────────────────────────────────────────
// Generates a clean PDF using PDFKit when the Python ML service is unreachable.
// This allows the report endpoint to work on Netlify / environments without the
// Python service running.
async function generateFallbackPDF(payload: {
  period: string;
  format: string;
  calculation: any;
  explainability: any[];
  trends: any[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { period, format, calculation, explainability, trends } = payload;
    const calc = calculation || {};
    const scope1 = (calc.scope1Kg || 0) / 1000;
    const scope2 = (calc.scope2Kg || 0) / 1000;
    const scope3 = (calc.scope3Kg || 0) / 1000;
    const total  = (calc.totalKg  || 0) / 1000;
    const breakdown: any[] = calc.breakdown || [];

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const green = '#10B981';
    const dark  = '#0F172A';
    const muted = '#64748B';
    const red   = '#DC2626';

    const hr = (y?: number) => {
      const yPos = y ?? doc.y;
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
    };

    const section = (title: string) => {
      doc.moveDown(0.8);
      hr();
      doc.fontSize(13).fillColor(dark).font('Helvetica-Bold').text(title);
      doc.moveDown(0.4);
    };

    const row = (label: string, value: string) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text(label, 50, doc.y, { continued: true, width: 200 });
      doc.font('Helvetica').fillColor(dark).text(value, { align: 'left' });
    };

    // ── Cover ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 120).fill(dark);
    doc.fontSize(22).fillColor(green).font('Helvetica-Bold')
      .text('Carbon Footprint Predictive Report', 50, 32);
    doc.fontSize(11).fillColor('#CBD5E1').font('Helvetica')
      .text(`${format} Framework  ·  Period: ${period}`, 50, 66);
    doc.fontSize(9).fillColor('#94A3B8')
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 90);

    doc.y = 140;

    // ── Disclaimer ───────────────────────────────────────────────────────────
    doc.rect(50, doc.y, 495, 36).fill('#FEF2F2').stroke('#FCA5A5');
    doc.fontSize(8).fillColor(red).font('Helvetica-Bold')
      .text('IMPORTANT: This is a draft summary modelled on BRSR/CSRD structures. NOT a certified regulatory filing.', 58, doc.y - 28, { width: 479 });
    doc.y += 20;
    doc.moveDown(1);

    // ── 1. Emissions Summary ─────────────────────────────────────────────────
    section('1. Carbon Emissions Inventory Summary');
    doc.fontSize(9).fillColor(muted).font('Helvetica')
      .text(`Total emissions for period ${period}: `, { continued: true });
    doc.font('Helvetica-Bold').fillColor(dark).text(`${total.toFixed(3)} metric tons CO2e`);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const cols = [50, 160, 360, 460];
    const headers = ['Scope', 'Description', 'Emissions (t CO2e)', 'Share'];
    doc.rect(50, tableTop, 495, 18).fill('#F1F5F9');
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor(dark).font('Helvetica-Bold').text(h, cols[i], tableTop + 4, { width: cols[i + 1] ? cols[i + 1] - cols[i] - 4 : 80 });
    });
    doc.y = tableTop + 20;

    const tableRows = [
      ['Scope 1 (Direct)', 'Direct fuel burn (diesel, gas)', scope1.toFixed(3), total > 0 ? `${((scope1 / total) * 100).toFixed(1)}%` : '0%'],
      ['Scope 2 (Energy)', 'Purchased grid electricity', scope2.toFixed(3), total > 0 ? `${((scope2 / total) * 100).toFixed(1)}%` : '0%'],
      ['Scope 3 (Value Chain)', 'Supply chain, freight, raw materials', scope3.toFixed(3), total > 0 ? `${((scope3 / total) * 100).toFixed(1)}%` : '0%'],
      ['TOTAL', 'Aggregate ML-corrected footprint', total.toFixed(3), '100%'],
    ];
    tableRows.forEach((r, ri) => {
      const rowY = doc.y;
      if (ri % 2 === 0) doc.rect(50, rowY, 495, 16).fill('#F8FAFC');
      r.forEach((cell, ci) => {
        doc.fontSize(8).fillColor(ri === 3 ? dark : muted)
          .font(ri === 3 ? 'Helvetica-Bold' : 'Helvetica')
          .text(cell, cols[ci], rowY + 3, { width: cols[ci + 1] ? cols[ci + 1] - cols[ci] - 4 : 80 });
      });
      doc.y = rowY + 18;
    });

    // ── 2. Activity Breakdown ────────────────────────────────────────────────
    if (breakdown.length > 0) {
      section('2. Activity Breakdown');
      breakdown.forEach((b: any) => {
        row(`• ${b.activityType}`, `${(b.kg / 1000).toFixed(3)} t CO2e   (${b.pct.toFixed(1)}%)`);
        doc.moveDown(0.3);
      });
    }

    // ── 3. Historical Trend ──────────────────────────────────────────────────
    if (trends.length > 0) {
      section('3. Emissions Historical Trend');
      trends.slice(-8).forEach((t: any) => {
        row(`Period ${t.period}`, `${(t.totalKg / 1000).toFixed(3)} t CO2e`);
        doc.moveDown(0.3);
      });
    }

    // ── 4. SHAP / Explainability ─────────────────────────────────────────────
    section('4. Explainable AI (SHAP) Model Factors');
    if (explainability.length > 0) {
      explainability.forEach((f: any, i: number) => {
        doc.fontSize(9).fillColor(dark).font('Helvetica-Bold')
          .text(`${i + 1}. ${f.feature} — ${f.contributionPct.toFixed(1)}% weight`);
        doc.fontSize(8).fillColor(muted).font('Helvetica').text(f.plainLanguage || '');
        doc.moveDown(0.4);
      });
    } else {
      doc.fontSize(9).fillColor(muted).font('Helvetica')
        .text('No ML model corrections applied for this period. Standard local emission factors used.');
    }

    // ── 5. Recommendations ───────────────────────────────────────────────────
    section('5. Reduction Recommendations');
    const recs: string[] = [];
    if (scope2 > 0)  recs.push(`Renewable Energy Sourcing — Transitioning 50% of electricity to solar/wind could save ${(scope2 * 0.5).toFixed(3)} t CO2e.`);
    if (scope3 > 0)  recs.push(`Intermodal Freight — Shifting 30% of road freight to rail is projected to reduce Scope 3 by ${(scope3 * 0.3).toFixed(3)} t CO2e.`);
    recs.push('Equipment Efficiency Auditing — Upgrading older diesel machinery can yield 10–15% Scope 1 reduction.');
    recs.push('Science-Based Targets — Adopt SBTi-aligned net-zero pathway for BRSR/CSRD compliance.');

    recs.forEach((rec, i) => {
      doc.fontSize(9).fillColor(dark).font('Helvetica-Bold').text(`${i + 1}.`, 50, doc.y, { continued: true, width: 20 });
      doc.font('Helvetica').fillColor(muted).text(` ${rec}`, { width: 475 });
      doc.moveDown(0.4);
    });

    // ── Footer ───────────────────────────────────────────────────────────────
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor(red).font('Helvetica-Bold')
        .text('DRAFT SUMMARY — NOT A CERTIFIED REGULATORY FILING', 50, 820, { width: 400 });
      doc.fontSize(7).fillColor(muted).font('Helvetica')
        .text(`Page ${i + 1}`, 450, 820, { width: 100, align: 'right' });
    }

    doc.end();
  });
}

export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { period, format } = req.body; // format: "BRSR" | "CSRD"

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!period || !format) {
      return res.status(400).json({ error: 'ValidationError', detail: 'Period and format (BRSR or CSRD) are required' });
    }

    // 1. Fetch calculation and explanation results for this period
    const calc = await CalculationResult.findOne({ companyId, period });
    if (!calc) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'No calculation data found for this period. Please add activity entries first.' });
    }

    const explain = await ExplainabilityResult.findOne({ calculationResultId: calc._id });

    // 2. Fetch past trends for comparison chart
    const trends = await CalculationResult.find({ companyId }).sort({ period: 1 });

    // 3. Prepare payload for report generation
    const reportPayload = {
      period,
      format,
      calculation: {
        scope1Kg: calc.scope1Kg,
        scope2Kg: calc.scope2Kg,
        scope3Kg: calc.scope3Kg,
        totalKg: calc.totalKg,
        baselineTotalKg: calc.baselineTotalKg,
        correctedTotalKg: calc.correctedTotalKg,
        breakdown: calc.breakdown
      },
      explainability: explain ? explain.topFactors : [],
      trends: trends.map(t => ({
        period: t.period,
        totalKg: t.totalKg
      }))
    };

    // 4. Attempt to call FastAPI to generate PDF; fall back to Node-side PDF if unreachable
    let pdfBuffer: Buffer;
    let usedFallback = false;

    try {
      const response = await axios.post(`${ML_SERVICE_URL}/report`, reportPayload, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30s timeout for PDF generation
      });
      pdfBuffer = Buffer.from(response.data);
    } catch (mlErr: any) {
      if (isNetworkError(mlErr)) {
        console.warn('[report] ML service unreachable, generating PDF in Node.js fallback');
        usedFallback = true;
        pdfBuffer = await generateFallbackPDF(reportPayload);
      } else {
        throw mlErr;
      }
    }

    // 5. Ensure reports directory exists
    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 6. Save PDF to disk
    const fileName = `report_${companyId}_${period}_${format}_${Date.now()}${usedFallback ? '_local' : ''}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // 7. Save report entry in MongoDB
    const report = new Report({
      companyId,
      period,
      format,
      fileName,
      generatedAt: new Date()
    });
    await report.save();

    // 8. Stream the file back to the browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${format}_Report_${period}.pdf`);
    return res.send(pdfBuffer);

  } catch (err: any) {
    console.error('Error generating report:', err.message);
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

export const getReportsList = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const reports = await Report.find({ companyId }).sort({ generatedAt: -1 });
    return res.status(200).json({ reports });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

export const downloadReportFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const report = await Report.findOne({ _id: id, companyId });
    if (!report) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'Report record not found' });
    }

    const filePath = path.join(__dirname, '../../public/reports', report.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'PDF file not found on server disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${report.format}_Report_${report.period}.pdf`);
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
