import { Response } from 'express';
import axios from 'axios';
import { CalculationResult } from '../models/calculationResult.model';
import { WhatIfScenario } from '../models/whatIfScenario.model';
import { ActivityEntry } from '../models/activityEntry.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// ─── Local What-If Engine ─────────────────────────────────────────────────────
// Mirrors the Python /whatif logic so simulations work on Netlify without the
// Python ML service. The math is straightforward:
//   - "shift_to_rail": road transport kg *= (1 - adjustmentPct/100)
//   - "renewable_share": electricity kg *= (1 - adjustmentPct/100)
//   - "supplier_swap": rawMaterial kg *= (1 - adjustmentPct/100)
// Each adjustment represents the percentage reduction in that category's emissions.
function computeLocalWhatIf(
  baseCalc: any,
  changes: Array<{ activityType: string; adjustmentType: string; adjustmentPct: number }>
) {
  // Build a mutable copy of the breakdown
  const adjustedBreakdown = (baseCalc.breakdown || []).map((item: any) => ({
    activityType: item.activityType,
    kg: item.kg,
    pct: item.pct,
  }));

  // Apply each change
  for (const change of changes) {
    const target = adjustedBreakdown.find((b: any) => b.activityType === change.activityType);
    if (target && change.adjustmentPct > 0) {
      const reductionFactor = 1 - change.adjustmentPct / 100;
      target.kg = Math.max(0, target.kg * reductionFactor);
    }
  }

  // Recalculate totals from adjusted breakdown
  const projectedTotalKg = adjustedBreakdown.reduce((sum: number, b: any) => sum + b.kg, 0);
  const savingsKg = (baseCalc.totalKg || 0) - projectedTotalKg;

  // Rebuild percentages
  adjustedBreakdown.forEach((b: any) => {
    b.pct = projectedTotalKg > 0 ? (b.kg / projectedTotalKg) * 100 : 0;
  });

  return {
    projectedTotalKg,
    savingsKg: Math.max(0, savingsKg),
    breakdown: adjustedBreakdown,
  };
}

export const runWhatIfSimulation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { baseCalculationResultId, changes } = req.body;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!baseCalculationResultId || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'ValidationError', detail: 'baseCalculationResultId and changes array are required' });
    }

    // 1. Fetch base calculation result
    const baseCalc = await CalculationResult.findOne({ _id: baseCalculationResultId, companyId });
    if (!baseCalc) {
      return res.status(404).json({ error: 'NotFoundError', detail: 'Base calculation result not found' });
    }

    // 2. If no changes provided, return baseline (no reductions)
    if (changes.length === 0) {
      const zeroResult = {
        projectedTotalKg: baseCalc.totalKg,
        savingsKg: 0,
        breakdown: baseCalc.breakdown,
      };
      return res.status(200).json({
        scenario: {
          _id: null,
          companyId,
          baseCalculationResultId,
          changes: [],
          projectedTotalKg: zeroResult.projectedTotalKg,
          savingsKg: 0,
        },
        projectedBreakdown: zeroResult.breakdown,
        engine: 'local-baseline',
      });
    }

    // 3. Try Python ML service first (richer model — accounts for upstream dependencies)
    //    Fall back to local linear model if ML service is unreachable.
    let whatifData: any;
    let engine = 'ml-service';

    try {
      const entries = await ActivityEntry.find({ companyId, period: baseCalc.period });
      const whatifPayload = {
        entries: entries.map(e => ({
          activityType: e.activityType,
          quantity: e.quantity,
          unit: e.unit,
          region: e.region,
          equipmentAgeYears: e.equipmentAgeYears || 0,
          cargoWeightTons: e.cargoWeightTons || 0,
        })),
        changes: changes.map(c => ({
          activityType: c.activityType,
          adjustmentType: c.adjustmentType,
          adjustmentPct: c.adjustmentPct,
        })),
      };

      const whatifResponse = await axios.post(`${ML_SERVICE_URL}/whatif`, whatifPayload, { timeout: 5000 });
      whatifData = whatifResponse.data;
    } catch (mlErr: any) {
      const isOffline =
        !mlErr.response ||
        mlErr.code === 'ECONNREFUSED' ||
        mlErr.code === 'ETIMEDOUT' ||
        mlErr.code === 'ECONNABORTED' ||
        mlErr.code === 'ENOTFOUND';

      if (isOffline) {
        // Fall back to the local linear model — works without Python
        console.warn('[simulator] ML service unreachable, using local what-if engine');
        whatifData = computeLocalWhatIf(baseCalc, changes);
        engine = 'local-linear';
      } else {
        throw mlErr;
      }
    }

    // 4. Save scenario to DB
    const scenario = new WhatIfScenario({
      companyId,
      baseCalculationResultId,
      changes,
      projectedTotalKg: whatifData.projectedTotalKg,
      savingsKg: whatifData.savingsKg,
    });
    await scenario.save();

    return res.status(200).json({
      scenario,
      projectedBreakdown: whatifData.breakdown,
      engine,
    });

  } catch (err: any) {
    console.error('What-if simulation error:', err.message);
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
