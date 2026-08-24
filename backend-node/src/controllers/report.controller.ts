import { Response } from 'express';
import axios from 'axios';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNABORTED' ||
    err.message === 'Network Error' ||
    !err.response
  );
}

// ─── Pure-JS PDF generator (pdf-lib) ─────────────────────────────────────────
// Works in any serverless environment — no native binaries, no filesystem writes.
async function generateFallbackPDF(payload: {
  period: string;
  format: string;
  calculation: any;
  explainability: any[];
  trends: any[];
}): Promise<Buffer> {
  const { period, format, calculation, explainability, trends } = payload;
  const calc = calculation || {};
  const scope1 = (calc.scope1Kg || 0) / 1000;
  const scope2 = (calc.scope2Kg || 0) / 1000;
  const scope3 = (calc.scope3Kg || 0) / 1000;
  const total  = (calc.totalKg  || 0) / 1000;
  const breakdown: any[] = calc.breakdown || [];

  const pdfDoc = await PDFDocument.create();
  const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colours
  const green  = rgb(0.063, 0.725, 0.506);  // #10B981
  const dark   = rgb(0.059, 0.090, 0.161);  // #0F172A
  const muted  = rgb(0.392, 0.455, 0.545);  // #64748B
  const red    = rgb(0.863, 0.149, 0.149);  // #DC2626
  const white  = rgb(1, 1, 1);
  const slate  = rgb(0.945, 0.949, 0.961);  // #F1F5F9
  const bgCard = rgb(0.973, 0.980, 0.992);  // #F8FAFC

  // Page helpers
  let page = pdfDoc.addPage([595, 842]);  // A4
  let y = 842;

  const newPage = () => {
    page = pdfDoc.addPage([595, 842]);
    y = 802;
  };

  const checkY = (needed: number) => {
    if (y < needed + 50) newPage();
  };

  const drawText = (text: string, x: number, yPos: number, opts: {
    font?: typeof boldFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  } = {}) => {
    const { font = normalFont, size = 9, color = dark, maxWidth } = opts;
    if (maxWidth) {
      // Simple word-wrap
      const words = text.split(' ');
      let line = '';
      let lineY = yPos;
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && line) {
          page.drawText(line, { x, y: lineY, size, font, color });
          lineY -= size * 1.4;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) page.drawText(line, { x, y: lineY, size, font, color });
      return yPos - lineY + size * 1.4;
    }
    page.drawText(text, { x, y: yPos, size, font, color });
    return size * 1.4;
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, fillColor: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color: fillColor });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: muted });
  };

  // ── Cover Header ────────────────────────────────────────────────────────────
  drawRect(0, 720, 595, 122, dark);
  drawText('Carbon Footprint Predictive Report', 40, 800, { font: boldFont, size: 22, color: green });
  drawText(`${format} Framework Alignment  ·  Reporting Period: ${period}`, 40, 768, { font: normalFont, size: 11, color: white });
  drawText(`Generated: ${new Date().toLocaleString()}`, 40, 748, { font: normalFont, size: 9, color: muted });
  y = 700;

  // ── Disclaimer ───────────────────────────────────────────────────────────────
  drawRect(40, y - 30, 515, 38, rgb(1, 0.949, 0.949));
  page.drawRectangle({ x: 40, y: y - 30, width: 515, height: 38, borderColor: red, borderWidth: 0.8 });
  drawText('IMPORTANT: This is a draft summary modelled on BRSR/CSRD structures. NOT a certified regulatory filing.', 52, y - 10, { font: boldFont, size: 8, color: red, maxWidth: 490 });
  y -= 50;

  // ── Section 1: Emissions Summary ─────────────────────────────────────────────
  checkY(200);
  y -= 10;
  drawRect(40, y - 2, 515, 20, dark);
  drawText('1. Carbon Emissions Inventory Summary', 48, y + 6, { font: boldFont, size: 12, color: white });
  y -= 30;

  drawText(`Total emissions for reporting period ${period}:`, 40, y, { font: normalFont, size: 9, color: muted });
  y -= 14;
  drawText(`${total.toFixed(3)} metric tons CO2e`, 40, y, { font: boldFont, size: 16, color: green });
  y -= 24;

  // Table header
  drawRect(40, y - 4, 515, 18, slate);
  drawText('Scope Layer', 44, y + 2, { font: boldFont, size: 8, color: dark });
  drawText('Description', 160, y + 2, { font: boldFont, size: 8, color: dark });
  drawText('Emissions (t CO2e)', 370, y + 2, { font: boldFont, size: 8, color: dark });
  drawText('Share', 490, y + 2, { font: boldFont, size: 8, color: dark });
  y -= 18;

  const tableRows = [
    ['Scope 1 (Direct)', 'Direct fuel burn — diesel, natural gas', scope1.toFixed(3), total > 0 ? `${((scope1 / total) * 100).toFixed(1)}%` : '—'],
    ['Scope 2 (Energy)', 'Purchased grid electricity (market-based)', scope2.toFixed(3), total > 0 ? `${((scope2 / total) * 100).toFixed(1)}%` : '—'],
    ['Scope 3 (Value Chain)', 'Supply chain, freight, raw materials', scope3.toFixed(3), total > 0 ? `${((scope3 / total) * 100).toFixed(1)}%` : '—'],
    ['TOTAL', 'Aggregate ML-corrected footprint', total.toFixed(3), '100%'],
  ];

  tableRows.forEach((row, ri) => {
    const rowH = 16;
    if (ri % 2 === 0) drawRect(40, y - rowH + 12, 515, rowH, bgCard);
    const isTotal = ri === tableRows.length - 1;
    if (isTotal) drawRect(40, y - rowH + 12, 515, rowH, slate);
    const fnt = isTotal ? boldFont : normalFont;
    drawText(row[0], 44, y + 2, { font: fnt, size: 8, color: dark });
    drawText(row[1], 160, y + 2, { font: normalFont, size: 8, color: muted, maxWidth: 200 });
    drawText(row[2], 370, y + 2, { font: fnt, size: 8, color: dark });
    drawText(row[3], 490, y + 2, { font: fnt, size: 8, color: isTotal ? green : dark });
    y -= rowH;
  });

  // ── Section 2: Activity Breakdown ────────────────────────────────────────────
  if (breakdown.length > 0) {
    checkY(100);
    y -= 20;
    drawRect(40, y - 2, 515, 20, dark);
    drawText('2. Activity Breakdown by Category', 48, y + 6, { font: boldFont, size: 12, color: white });
    y -= 22;
    breakdown.forEach((b: any) => {
      checkY(20);
      drawText(`• ${b.activityType}`, 48, y, { font: boldFont, size: 9, color: dark });
      drawText(`${(b.kg / 1000).toFixed(3)} t CO2e  (${b.pct.toFixed(1)}%)`, 180, y, { font: normalFont, size: 9, color: muted });
      y -= 14;
    });
  }

  // ── Section 3: Historical Trend ──────────────────────────────────────────────
  if (trends.length > 0) {
    checkY(100);
    y -= 20;
    drawRect(40, y - 2, 515, 20, dark);
    drawText('3. Historical Emissions Trend', 48, y + 6, { font: boldFont, size: 12, color: white });
    y -= 22;
    const maxVal = Math.max(...trends.map((t: any) => t.totalKg || 0));
    trends.slice(-8).forEach((t: any) => {
      checkY(18);
      const barW = maxVal > 0 ? Math.max(2, ((t.totalKg || 0) / maxVal) * 300) : 2;
      drawText(t.period, 44, y, { font: normalFont, size: 8, color: muted });
      drawRect(110, y - 2, barW, 10, green);
      drawText(`${((t.totalKg || 0) / 1000).toFixed(3)} t`, 418, y, { font: normalFont, size: 8, color: dark });
      y -= 16;
    });
  }

  // ── Section 4: SHAP Explainability ───────────────────────────────────────────
  checkY(120);
  y -= 20;
  drawRect(40, y - 2, 515, 20, dark);
  drawText('4. Explainable AI (SHAP) Model Factors', 48, y + 6, { font: boldFont, size: 12, color: white });
  y -= 22;

  if (explainability.length > 0) {
    explainability.slice(0, 5).forEach((f: any, i: number) => {
      checkY(40);
      drawText(`${i + 1}. ${f.feature}`, 44, y, { font: boldFont, size: 9, color: dark });
      drawText(`${f.contributionPct.toFixed(1)}% contribution`, 300, y, { font: normalFont, size: 9, color: green });
      y -= 13;
      const dropped = drawText(f.plainLanguage || '', 52, y, { font: normalFont, size: 8, color: muted, maxWidth: 490 });
      y -= (dropped > 11 ? dropped : 11) + 4;
    });
  } else {
    drawText('No ML model corrections applied for this period. Standard local emission factors (India grid: 0.82 kg/kWh, Diesel: 2.68 kg/L) used.', 44, y, { font: normalFont, size: 9, color: muted, maxWidth: 500 });
    y -= 28;
  }

  // ── Section 5: Recommendations ───────────────────────────────────────────────
  checkY(140);
  y -= 20;
  drawRect(40, y - 2, 515, 20, dark);
  drawText('5. Reduction Recommendations', 48, y + 6, { font: boldFont, size: 12, color: white });
  y -= 22;

  const recs: { title: string; detail: string }[] = [];
  if (scope2 > 0) recs.push({
    title: 'Renewable Energy Sourcing',
    detail: `Transitioning 50% of electricity load to solar/wind power can save ~${(scope2 * 0.5).toFixed(3)} t CO2e annually.`
  });
  if (scope3 > 0) recs.push({
    title: 'Intermodal Freight Logistics',
    detail: `Shifting 30% of road freight to rail transport is projected to reduce Scope 3 by ~${(scope3 * 0.3).toFixed(3)} t CO2e.`
  });
  recs.push({ title: 'Equipment Efficiency Auditing', detail: 'Upgrading diesel-burning machinery older than 10 years can yield 10–15% Scope 1 emission reduction.' });
  recs.push({ title: 'Science-Based Targets (SBTi)', detail: 'Adopt SBTi-aligned net-zero pathway targets for BRSR/CSRD compliance and Paris Agreement 1.5°C alignment.' });

  recs.forEach((rec, i) => {
    checkY(50);
    drawText(`${i + 1}. ${rec.title}`, 44, y, { font: boldFont, size: 9, color: green });
    y -= 13;
    const dropped = drawText(rec.detail, 52, y, { font: normalFont, size: 8, color: muted, maxWidth: 490 });
    y -= (dropped > 11 ? dropped : 11) + 8;
  });

  // ── Footer on all pages ───────────────────────────────────────────────────────
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const pg = pdfDoc.getPage(i);
    pg.drawText('DRAFT SUMMARY — NOT A CERTIFIED REGULATORY FILING', { x: 40, y: 22, size: 7, font: boldFont, color: red });
    pg.drawText(`Page ${i + 1} of ${pageCount}`, { x: 480, y: 22, size: 7, font: normalFont, color: muted });
    drawLine(40, 34, 555, 34);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export const generateReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { period, format } = req.body;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!period || !format) {
      return res.status(400).json({ error: 'ValidationError', detail: 'Period and format (BRSR or CSRD) are required' });
    }

    // 1. Fetch calculation and explanation results
    const calc = await CalculationResult.findOne({ companyId, period });
    if (!calc) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'No calculation data found for this period. Please add activity entries first.' });
    }

    const explain = await ExplainabilityResult.findOne({ calculationResultId: calc._id });
    const trends  = await CalculationResult.find({ companyId }).sort({ period: 1 });

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
      trends: trends.map(t => ({ period: t.period, totalKg: t.totalKg }))
    };

    // 2. Try ML service PDF; fall back to Node-side pdf-lib PDF (3s timeout prevents Netlify 502)
    let pdfBuffer: Buffer;
    let usedFallback = false;

    try {
      const response = await axios.post(`${ML_SERVICE_URL}/report`, reportPayload, {
        responseType: 'arraybuffer',
        timeout: 8000
      });
      pdfBuffer = Buffer.from(response.data);
    } catch (mlErr: any) {
      if (isNetworkError(mlErr)) {
        console.warn('[report] ML service unreachable, generating PDF in Node.js via pdf-lib');
        usedFallback = true;
        pdfBuffer = await generateFallbackPDF(reportPayload);
      } else {
        throw mlErr;
      }
    }

    // 3. Persist report record in MongoDB (no file disk write — Lambda has no persistent disk)
    const fileName = `report_${String(companyId)}_${period}_${format}_${Date.now()}${usedFallback ? '_local' : ''}.pdf`;
    const report = new Report({
      companyId,
      period,
      format,
      fileName,
      generatedAt: new Date()
    });
    await report.save();

    // 4. Stream PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${format}_Report_${period}.pdf"`);
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

    // On serverless, we don't have the original file — regenerate it on demand
    const calc = await CalculationResult.findOne({ companyId, period: report.period });
    if (!calc) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'Calculation data no longer available for this period' });
    }
    const explain = await ExplainabilityResult.findOne({ calculationResultId: calc._id });
    const trends  = await CalculationResult.find({ companyId }).sort({ period: 1 });

    const pdfBuffer = await generateFallbackPDF({
      period: report.period,
      format: report.format,
      calculation: {
        scope1Kg: calc.scope1Kg, scope2Kg: calc.scope2Kg, scope3Kg: calc.scope3Kg,
        totalKg: calc.totalKg, baselineTotalKg: calc.baselineTotalKg,
        correctedTotalKg: calc.correctedTotalKg, breakdown: calc.breakdown
      },
      explainability: explain ? explain.topFactors : [],
      trends: trends.map(t => ({ period: t.period, totalKg: t.totalKg }))
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.format}_Report_${report.period}.pdf"`);
    return res.send(pdfBuffer);

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
