import { Response } from 'express';
import { PredictionLog } from '../models/predictionLog.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { ActivityEntry } from '../models/activityEntry.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { recalculateEmissions } from './activity.controller';

/**
 * GET /api/history
 * Fetch all prediction logs for the authenticated user's company
 */
export const getPredictionHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const logs = await PredictionLog.find({ companyId })
      .sort({ timestamp: -1 })
      .limit(100);

    return res.status(200).json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

/**
 * GET /api/history/:id
 * Get single prediction log details for pre-prediction inspection
 */
export const getPredictionLogById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const log = await PredictionLog.findOne({ _id: id, companyId });
    if (!log) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'Prediction log not found' });
    }

    return res.status(200).json({ log });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

/**
 * DELETE /api/history/:id
 * Remove a prediction log record
 */
export const deletePredictionLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    await PredictionLog.deleteOne({ _id: id, companyId });
    return res.status(200).json({ message: 'Prediction log deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

/**
 * POST /api/history/seed-my-company
 * Seeds Apple Demo dataset (2015-2022 + 2026-08) directly into the user's logged-in company scope!
 */
export const seedUserCompanyData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    // Historical Apple dataset records (2015 - 2022)
    const dataset = [
      { fiscalYear: '2015', scope1Kg: 28100000, scope2Kg: 42460000, scope3Kg: 38309440000, totalKg: 38380000000 },
      { fiscalYear: '2016', scope1Kg: 34100000, scope2Kg: 36200000, scope3Kg: 29509700000, totalKg: 29580000000 },
      { fiscalYear: '2017', scope1Kg: 41200000, scope2Kg: 21800000, scope3Kg: 27357000000, totalKg: 27420000000 },
      { fiscalYear: '2018', scope1Kg: 48300000, scope2Kg: 11400000, scope3Kg: 25070300000, totalKg: 25130000000 },
      { fiscalYear: '2019', scope1Kg: 52100000, scope2Kg: 8900000, scope3Kg: 24979000000, totalKg: 25040000000 },
      { fiscalYear: '2020', scope1Kg: 49800000, scope2Kg: 6400000, scope3Kg: 22468800000, totalKg: 22524400000 },
      { fiscalYear: '2021', scope1Kg: 53200000, scope2Kg: 4100000, scope3Kg: 22462700000, totalKg: 22520000000 },
      { fiscalYear: '2022', scope1Kg: 55200000, scope2Kg: 3000000, scope3Kg: 20211800000, totalKg: 20270000000 },
    ];

    // Clear old calculation & prediction log data for this company
    const oldCalcs = await CalculationResult.find({ companyId });
    const oldCalcIds = oldCalcs.map(c => c._id);
    await ExplainabilityResult.deleteMany({ calculationResultId: { $in: oldCalcIds } });
    await CalculationResult.deleteMany({ companyId });
    await PredictionLog.deleteMany({ companyId });

    // Seed calculations and prediction logs
    for (const record of dataset) {
      const period = `${record.fiscalYear}-12`;
      
      const calc = new CalculationResult({
        companyId,
        period,
        scope1Kg: record.scope1Kg,
        scope2Kg: record.scope2Kg,
        scope3Kg: record.scope3Kg,
        totalKg: record.totalKg,
        baselineTotalKg: record.totalKg * 1.05, // 5% baseline uplift
        correctedTotalKg: record.totalKg,
        breakdown: [
          { activityType: 'diesel', kg: record.scope1Kg, pct: record.totalKg > 0 ? (record.scope1Kg / record.totalKg) * 100 : 0 },
          { activityType: 'electricity', kg: record.scope2Kg, pct: record.totalKg > 0 ? (record.scope2Kg / record.totalKg) * 100 : 0 },
          { activityType: 'roadTransport', kg: record.scope3Kg * 0.4, pct: record.totalKg > 0 ? ((record.scope3Kg * 0.4) / record.totalKg) * 100 : 0 },
          { activityType: 'rawMaterial', kg: record.scope3Kg * 0.6, pct: record.totalKg > 0 ? ((record.scope3Kg * 0.6) / record.totalKg) * 100 : 0 }
        ],
        modelVersion: '1.0.0 (XGBoost Regressor)'
      });
      await calc.save();

      const topFactors = [
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
      ];

      await ExplainabilityResult.create({
        calculationResultId: calc._id,
        topFactors,
        createdAt: new Date()
      });

      // Also create a PredictionLog entry
      await PredictionLog.create({
        companyId,
        period,
        triggerType: 'demo_seed',
        timestamp: new Date(parseInt(record.fiscalYear), 11, 31),
        prePredictionBaseline: {
          scope1Kg: record.scope1Kg * 1.05,
          scope2Kg: record.scope2Kg * 1.05,
          scope3Kg: record.scope3Kg * 1.05,
          totalKg: record.totalKg * 1.05,
          entryCount: 24,
          rawEntries: [
            { activityType: 'diesel', quantity: 10500, unit: 'litre', region: 'Global', baselineKg: record.scope1Kg },
            { activityType: 'electricity', quantity: 50000, unit: 'kWh', region: 'India', baselineKg: record.scope2Kg },
            { activityType: 'roadTransport', quantity: 15000, unit: 'km', region: 'Global', cargoWeightTons: 10, baselineKg: record.scope3Kg * 0.4 },
            { activityType: 'rawMaterial', quantity: 8000, unit: 'kg', region: 'Global', baselineKg: record.scope3Kg * 0.6 }
          ]
        },
        postPredictionModel: {
          correctedTotalKg: record.totalKg,
          scope1Kg: record.scope1Kg,
          scope2Kg: record.scope2Kg,
          scope3Kg: record.scope3Kg,
          deltaKg: record.totalKg - (record.totalKg * 1.05),
          deltaPct: -4.76,
          modelVersion: '1.0.0 (XGBoost Regressor)',
          topFactors,
          breakdown: calc.breakdown
        }
      });
    }

    // Seed recent 2026-08 period entries as well
    const recentPeriod = '2026-08';
    const recentEntries = [
      { companyId, period: recentPeriod, activityType: 'diesel', quantity: 1200, unit: 'litre', region: 'Global', equipmentAgeYears: 5 },
      { companyId, period: recentPeriod, activityType: 'electricity', quantity: 4500, unit: 'kWh', region: 'India', equipmentAgeYears: 2 },
      { companyId, period: recentPeriod, activityType: 'roadTransport', quantity: 2000, unit: 'km', region: 'Global', cargoWeightTons: 8 },
      { companyId, period: recentPeriod, activityType: 'rawMaterial', quantity: 1500, unit: 'kg', region: 'Global' }
    ];
    await ActivityEntry.deleteMany({ companyId, period: recentPeriod });
    await ActivityEntry.insertMany(recentEntries);

    // Recalculate recent period so 2026-08 has valid calculation and breakdown!
    await recalculateEmissions(companyId, recentPeriod);

    return res.status(200).json({
      message: 'Company dataset and prediction logs seeded successfully',
      periodsSeeded: dataset.length + 1
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
