import { Response } from 'express';
import axios from 'axios';
import { CalculationResult } from '../models/calculationResult.model';
import { WhatIfScenario } from '../models/whatIfScenario.model';
import { ActivityEntry } from '../models/activityEntry.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

export const runWhatIfSimulation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { baseCalculationResultId, changes } = req.body; // changes: Array of { activityType, adjustmentType, adjustmentPct }

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

    // 2. Fetch original activity entries for this period to send to Python for what-if recalculation
    const entries = await ActivityEntry.find({ companyId, period: baseCalc.period });

    const whatifPayload = {
      entries: entries.map(e => ({
        activityType: e.activityType,
        quantity: e.quantity,
        unit: e.unit,
        region: e.region,
        equipmentAgeYears: e.equipmentAgeYears || 0,
        cargoWeightTons: e.cargoWeightTons || 0
      })),
      changes: changes.map(c => ({
        activityType: c.activityType,
        adjustmentType: c.adjustmentType,
        adjustmentPct: c.adjustmentPct
      }))
    };

    // 3. Post to ml-service /whatif
    const whatifResponse = await axios.post(`${ML_SERVICE_URL}/whatif`, whatifPayload);
    const whatifData = whatifResponse.data; // { projectedTotalKg, savingsKg, breakdown }

    // 4. Save what-if scenario to DB
    const scenario = new WhatIfScenario({
      companyId,
      baseCalculationResultId,
      changes,
      projectedTotalKg: whatifData.projectedTotalKg,
      savingsKg: whatifData.savingsKg
    });
    await scenario.save();

    return res.status(200).json({
      scenario,
      projectedBreakdown: whatifData.breakdown
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
