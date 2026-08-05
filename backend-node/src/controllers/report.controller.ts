import { Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Report } from '../models/report.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

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

    // 3. Prepare payload for FastAPI report generation
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

    // 4. Call FastAPI to generate PDF
    const response = await axios.post(`${ML_SERVICE_URL}/report`, reportPayload, {
      responseType: 'arraybuffer'
    });

    // 5. Ensure reports directory exists
    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 6. Save PDF to disk
    const fileName = `report_${companyId}_${period}_${format}_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, response.data);

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
    return res.send(response.data);

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
