import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { recalculateEmissions } from './activity.controller';

export const getDashboardSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { period } = req.query;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!period) {
      return res.status(400).json({ error: 'ValidationError', detail: 'Period query parameter (YYYY-MM) is required' });
    }

    // Try to find calculation result
    let calculationResult = await CalculationResult.findOne({ companyId, period });

    // If it does not exist, try to recalculate it (in case entries were seeded/uploaded directly)
    if (!calculationResult) {
      try {
        await recalculateEmissions(companyId, period as string);
        calculationResult = await CalculationResult.findOne({ companyId, period });
      } catch (err) {
        // Recalculation failed or no entries existed
      }
    }

    if (!calculationResult) {
      return res.status(200).json({
        message: 'No emissions calculated for this period',
        data: null
      });
    }

    // Find explainability results
    const explainabilityResult = await ExplainabilityResult.findOne({ 
      calculationResultId: calculationResult._id 
    });

    return res.status(200).json({
      calculationResult,
      explainabilityResult: explainabilityResult || { topFactors: [] }
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

export const getDashboardTrend = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const trends = await CalculationResult.find({ companyId })
      .sort({ period: 1 }); // Sort chronologically

    return res.status(200).json({ trends });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

export const seedAppleDemoData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyName, records } = req.body;

    if (!companyName || !Array.isArray(records)) {
      return res.status(400).json({ error: 'ValidationError', detail: 'companyName and records array are required' });
    }

    // 1. Create/find company
    const company = await Company.findOneAndUpdate(
      { name: companyName },
      { industry: 'Technology', country: 'USA' },
      { upsert: true, new: true }
    );

    // 2. Create/find user
    const demoEmail = 'apple_demo@carbon.com';
    let user = await User.findOne({ email: demoEmail });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      user = new User({
        email: demoEmail,
        passwordHash,
        companyId: company._id,
        role: 'admin'
      });
      await user.save();
    }

    // 3. Clear existing trends for this company
    const existingCalcs = await CalculationResult.find({ companyId: company._id });
    const existingIds = existingCalcs.map(c => c._id);
    await ExplainabilityResult.deleteMany({ calculationResultId: { $in: existingIds } });
    await CalculationResult.deleteMany({ companyId: company._id });

    // 4. Save yearly summary records
    const createdRecords = [];
    for (const record of records) {
      const period = `${record.fiscalYear}-12`; // Represent FY as Dec month
      
      const calc = new CalculationResult({
        companyId: company._id,
        period,
        scope1Kg: record.scope1Kg,
        scope2Kg: record.scope2Kg,
        scope3Kg: record.scope3Kg,
        totalKg: record.totalKg,
        baselineTotalKg: record.totalKg,
        correctedTotalKg: record.totalKg,
        breakdown: [
          { activityType: 'diesel', kg: record.scope1Kg, pct: record.totalKg > 0 ? (record.scope1Kg / record.totalKg) * 100 : 0 },
          { activityType: 'electricity', kg: record.scope2Kg, pct: record.totalKg > 0 ? (record.scope2Kg / record.totalKg) * 100 : 0 },
          { activityType: 'roadTransport', kg: record.scope3Kg, pct: record.totalKg > 0 ? (record.scope3Kg / record.totalKg) * 100 : 0 }
        ],
        modelVersion: '1.0.0'
      });
      
      await calc.save();

      // Seed default SHAP explainability factors for seeded demo records
      await ExplainabilityResult.findOneAndUpdate(
        { calculationResultId: calc._id },
        {
          topFactors: [
            {
              feature: 'baselineKg',
              contributionPct: 72.5,
              plainLanguage: 'Historical corporate supply chain records and activity baselines represented 72.5% of annual calculated output.'
            },
            {
              feature: 'activityType',
              contributionPct: 18.2,
              plainLanguage: 'Scope 3 manufacturing and supplier material sourcing accounted for 18.2% of total variance.'
            },
            {
              feature: 'region',
              contributionPct: 9.3,
              plainLanguage: 'Global supply chain grid intensity and transport routes contributed 9.3% of annual adjustments.'
            }
          ],
          createdAt: new Date()
        },
        { upsert: true, new: true }
      );

      createdRecords.push(calc);
    }

    return res.status(200).json({ 
      message: 'Demo company and trend data seeded successfully',
      companyId: company._id,
      recordsCount: createdRecords.length
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

