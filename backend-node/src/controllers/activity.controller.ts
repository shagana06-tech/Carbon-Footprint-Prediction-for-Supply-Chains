import { Request, Response } from 'express';
import axios from 'axios';
import { ActivityEntry } from '../models/activityEntry.model';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// ─── Chunk helper ─────────────────────────────────────────────────────────────
// Splits an array into sub-arrays of at most `size` items so we never send a
// payload that exceeds FastAPI / Express body-size limits for large datasets.
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const CHUNK_SIZE = 500; // max entries per ML-service request

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

    // 2. Call /calculate on ML service — chunked for large datasets
    const calcInputs = entries.map(e => ({
      activityType: e.activityType,
      quantity: e.quantity,
      unit: e.unit,
      region: e.region,
      equipmentAgeYears: e.equipmentAgeYears || 0,
      cargoWeightTons: e.cargoWeightTons || 0,
      supplierId: e.supplierId || ''
    }));

    const calcChunks = chunkArray(calcInputs, CHUNK_SIZE);
    const calcResults = await Promise.all(
      calcChunks.map(chunk =>
        axios.post(`${ML_SERVICE_URL}/calculate`, { entries: chunk }).then(r => r.data)
      )
    );

    // Merge chunked calculate results
    const calcData = {
      scope1Kg: calcResults.reduce((s, r) => s + (r.scope1Kg || 0), 0),
      scope2Kg: calcResults.reduce((s, r) => s + (r.scope2Kg || 0), 0),
      scope3Kg: calcResults.reduce((s, r) => s + (r.scope3Kg || 0), 0),
      totalKg:  calcResults.reduce((s, r) => s + (r.totalKg  || 0), 0),
      // Flatten per-entry results preserving original order
      entries:  calcResults.flatMap(r => r.entries || []),
      // Merge breakdown maps by activityType
      breakdown: (() => {
        const map: Record<string, number> = {};
        for (const r of calcResults) {
          for (const b of (r.breakdown || [])) {
            map[b.activityType] = (map[b.activityType] || 0) + (b.kg || 0);
          }
        }
        const total = Object.values(map).reduce((s, v) => s + v, 0);
        return Object.keys(map).map(type => ({
          activityType: type,
          kg: map[type],
          pct: total > 0 ? (map[type] / total) * 100 : 0
        }));
      })()
    };

    // 3. Determine the season based on period (YYYY-MM)
    const month = period.split('-')[1];
    let season = 'Spring';
    if (['12', '01', '02'].includes(month)) season = 'Winter';
    else if (['03', '04', '05'].includes(month)) season = 'Spring';
    else if (['06', '07', '08'].includes(month)) season = 'Summer';
    else if (['09', '10', '11'].includes(month)) season = 'Autumn';

    // 4. Build the correction payload entries (index-aligned with original entries)
    const correctInputs = entries.map((e, idx) => ({
      baselineKg: calcData.entries[idx]?.baselineKg ?? 0,
      activityType: e.activityType,
      region: e.region,
      equipmentAgeYears: e.equipmentAgeYears || 0,
      season
    }));

    // 5. Call /correct — chunked
    const correctChunks = chunkArray(correctInputs, CHUNK_SIZE);
    const correctResults = await Promise.all(
      correctChunks.map(chunk =>
        axios.post(`${ML_SERVICE_URL}/correct`, { entries: chunk }).then(r => r.data)
      )
    );

    // Merge chunked correct results
    const correctData = {
      modelApplied: correctResults.some(r => r.modelApplied),
      modelVersion: correctResults[0]?.modelVersion || '1.0.0',
      correctedEntries: correctResults.flatMap(r => r.correctedEntries || [])
    };

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

    // 6. Call /explain — chunked (only need first chunk for SHAP, rest are aggregated)
    const explainChunks = chunkArray(correctInputs, CHUNK_SIZE);
    const explainResults = await Promise.all(
      explainChunks.map(chunk =>
        axios.post(`${ML_SERVICE_URL}/explain`, { entries: chunk }).then(r => r.data)
      )
    );

    // Merge SHAP topFactors by averaging contribution percentages across chunks
    const explainData = (() => {
      const factorMap: Record<string, { total: number; count: number; plainLanguage: string }> = {};
      for (const r of explainResults) {
        for (const f of (r.topFactors || [])) {
          if (!factorMap[f.feature]) {
            factorMap[f.feature] = { total: 0, count: 0, plainLanguage: f.plainLanguage || '' };
          }
          factorMap[f.feature].total += f.contributionPct || 0;
          factorMap[f.feature].count += 1;
        }
      }
      const topFactors = Object.entries(factorMap)
        .map(([feature, v]) => ({
          feature,
          contributionPct: v.total / v.count,
          plainLanguage: v.plainLanguage
        }))
        .sort((a, b) => b.contributionPct - a.contributionPct)
        .slice(0, 10);
      return { topFactors };
    })();

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

    // Bulk insert entries in batches to avoid MongoDB payload limits
    const DB_BATCH = 1000;
    let insertedCount = 0;
    for (let i = 0; i < preparedEntries.length; i += DB_BATCH) {
      const batch = preparedEntries.slice(i, i + DB_BATCH);
      const batchResult = await ActivityEntry.insertMany(batch);
      insertedCount += batchResult.length;
    }

    // Recalculate emissions for each unique period involved
    for (const period of uniquePeriods) {
      await recalculateEmissions(companyId, period);
    }

    return res.status(201).json({ message: 'Bulk upload completed successfully', count: insertedCount });
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
