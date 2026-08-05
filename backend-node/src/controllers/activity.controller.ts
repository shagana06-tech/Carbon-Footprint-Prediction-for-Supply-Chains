import { Request, Response } from 'express';
import axios from 'axios';
import { ActivityEntry } from '../models/activityEntry.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// Orchestrates the emissions calculations by contacting the Python ML service
export const recalculateEmissions = async (companyId: string, period: string) => {
  try {
    // 1. Fetch all activity entries for this company and period
    const entries = await ActivityEntry.find({ companyId, period });

    if (entries.length === 0) {
      // Clean up previous results if all entries are deleted
      await CalculationResult.deleteOne({ companyId, period });
      return;
    }

    // 2. Call /calculate on ML service to get baseline emissions
    const calcPayload = {
      entries: entries.map(e => ({
        activityType: e.activityType,
        quantity: e.quantity,
        unit: e.unit,
        region: e.region,
        equipmentAgeYears: e.equipmentAgeYears || 0,
        cargoWeightTons: e.cargoWeightTons || 0,
        supplierId: e.supplierId || ''
      }))
    };

    const calcResponse = await axios.post(`${ML_SERVICE_URL}/calculate`, calcPayload);
    const calcData = calcResponse.data; // { scope1Kg, scope2Kg, scope3Kg, totalKg, breakdown, entries: [{ baselineKg, scope }] }

    // 3. Determine the season based on period (YYYY-MM)
    const month = period.split('-')[1];
    let season = 'Spring';
    if (['12', '01', '02'].includes(month)) season = 'Winter';
    else if (['03', '04', '05'].includes(month)) season = 'Spring';
    else if (['06', '07', '08'].includes(month)) season = 'Summer';
    else if (['09', '10', '11'].includes(month)) season = 'Autumn';

    // 4. Map calculated baselines to correct payload
    const correctPayload = {
      entries: entries.map((e, idx) => ({
        baselineKg: calcData.entries[idx].baselineKg,
        activityType: e.activityType,
        region: e.region,
        equipmentAgeYears: e.equipmentAgeYears || 0,
        season
      }))
    };

    // 5. Call /correct to apply the ML correction model
    const correctResponse = await axios.post(`${ML_SERVICE_URL}/correct`, correctPayload);
    const correctData = correctResponse.data; // { correctedTotalKg, correctedEntries: [{ correctedKg }], modelApplied, modelVersion }

    let scope1Kg = calcData.scope1Kg;
    let scope2Kg = calcData.scope2Kg;
    let scope3Kg = calcData.scope3Kg;
    let totalKg = calcData.totalKg;
    let breakdown = calcData.breakdown;

    // If model was successfully applied, adjust emissions using corrected values
    if (correctData && correctData.modelApplied && Array.isArray(correctData.correctedEntries)) {
      let s1 = 0, s2 = 0, s3 = 0;
      const updatedBreakdownMap: Record<string, number> = {};

      entries.forEach((e, idx) => {
        const scopeItem = calcData.entries && calcData.entries[idx] ? calcData.entries[idx] : { scope: 3 };
        const scope = scopeItem.scope;
        const correctedObj = correctData.correctedEntries[idx] || { correctedKg: 0 };
        const correctedKg = typeof correctedObj.correctedKg === 'number' ? correctedObj.correctedKg : 0;

        if (scope === 1) s1 += correctedKg;
        else if (scope === 2) s2 += correctedKg;
        else if (scope === 3) s3 += correctedKg;

        updatedBreakdownMap[e.activityType] = (updatedBreakdownMap[e.activityType] || 0) + correctedKg;
      });

      scope1Kg = s1;
      scope2Kg = s2;
      scope3Kg = s3;
      totalKg = s1 + s2 + s3;

      // Rebuild the breakdown percentage based on corrected values
      breakdown = Object.keys(updatedBreakdownMap).map(type => ({
        activityType: type,
        kg: updatedBreakdownMap[type],
        pct: totalKg > 0 ? (updatedBreakdownMap[type] / totalKg) * 100 : 0
      }));
    }

    // 6. Call /explain to get SHAP values
    const explainResponse = await axios.post(`${ML_SERVICE_URL}/explain`, correctPayload);
    const explainData = explainResponse.data; // { topFactors: [{ feature, contributionPct, plainLanguage }] }

    // 7. Persist calculation results to database
    const calculationResult = await CalculationResult.findOneAndUpdate(
      { companyId, period },
      {
        scope1Kg,
        scope2Kg,
        scope3Kg,
        totalKg,
        baselineTotalKg: calcData.totalKg,
        correctedTotalKg: correctData.modelApplied ? totalKg : calcData.totalKg,
        breakdown,
        modelVersion: correctData.modelVersion || '1.0.0',
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 8. Persist explainability results to database
    await ExplainabilityResult.findOneAndUpdate(
      { calculationResultId: calculationResult._id },
      {
        topFactors: explainData.topFactors || [],
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

  } catch (err: any) {
    console.error('Error during emissions orchestration:', err.message);
    throw err;
  }
};

// Create a single activity entry
export const createActivityEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period, activityType, quantity, unit, region, equipmentAgeYears, cargoWeightTons, supplierId } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!period || !activityType || !quantity || !unit || !region) {
      return res.status(400).json({ error: 'ValidationError', detail: 'Missing required activity fields' });
    }

    // Core validation: quantity > 0
    if (quantity <= 0) {
      return res.status(400).json({ error: 'ValidationError', detail: 'Quantity must be greater than zero' });
    }

    // roadTransport validates cargoWeightTons
    if (activityType === 'roadTransport' && (!cargoWeightTons || cargoWeightTons <= 0)) {
      return res.status(400).json({ 
        error: 'ValidationError', 
        detail: 'cargoWeightTons is required and must be greater than zero when activityType is roadTransport' 
      });
    }

    const entry = new ActivityEntry({
      companyId,
      period,
      activityType,
      quantity,
      unit,
      region,
      equipmentAgeYears,
      cargoWeightTons,
      supplierId
    });

    await entry.save();

    // Trigger recalculation in background
    await recalculateEmissions(companyId, period);

    return res.status(201).json(entry);
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

// Bulk upload CSV parsed JSON list
export const bulkUploadCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entries } = req.body; // Array of entries
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'ValidationError', detail: 'An array of entries is required' });
    }

    const preparedEntries = [];
    const uniquePeriods = new Set<string>();

    for (const item of entries) {
      const { period, activityType, quantity, unit, region, equipmentAgeYears, cargoWeightTons, supplierId } = item;

      if (!period || !activityType || quantity === undefined || !unit || !region) {
        return res.status(400).json({ error: 'ValidationError', detail: 'Missing required fields in one of the entries' });
      }

      if (quantity <= 0) {
        return res.status(400).json({ error: 'ValidationError', detail: 'Quantity must be greater than zero for all entries' });
      }

      if (activityType === 'roadTransport' && (!cargoWeightTons || cargoWeightTons <= 0)) {
        return res.status(400).json({ 
          error: 'ValidationError', 
          detail: 'cargoWeightTons is required and must be greater than zero for roadTransport entries' 
        });
      }

      preparedEntries.push({
        companyId,
        period,
        activityType,
        quantity,
        unit,
        region,
        equipmentAgeYears: equipmentAgeYears || undefined,
        cargoWeightTons: cargoWeightTons || undefined,
        supplierId: supplierId || undefined
      });

      uniquePeriods.add(period);
    }

    // Bulk insert entries
    const result = await ActivityEntry.insertMany(preparedEntries);

    // Recalculate emissions for each unique period involved
    for (const period of uniquePeriods) {
      await recalculateEmissions(companyId, period);
    }

    return res.status(201).json({ message: 'Bulk upload completed successfully', count: result.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

// Fetch activity entries, paginated, filtered by period, scoped to companyId
export const getActivityEntries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { period, page = 1, limit = 10 } = req.query;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const query: any = { companyId };
    if (period) {
      query.period = period;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const entries = await ActivityEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await ActivityEntry.countDocuments(query);

    return res.status(200).json({
      entries,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

// Delete a single entry
export const deleteActivityEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    const entry = await ActivityEntry.findOne({ _id: id, companyId });
    if (!entry) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'Activity entry not found or unauthorized' });
    }

    const period = entry.period;
    await entry.deleteOne();

    // Trigger recalculation in background
    await recalculateEmissions(companyId, period);

    return res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
