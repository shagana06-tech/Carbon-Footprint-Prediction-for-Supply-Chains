import { Schema, model, Document, Types } from 'mongoose';

export interface ISceanarioChange {
  activityType: 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
  adjustmentType: string; // e.g. "shift_to_rail" | "renewable_share" | "supplier_swap"
  adjustmentPct: number; // e.g. 30 for 30%
}

export interface IWhatIfScenario extends Document {
  companyId: Types.ObjectId;
  baseCalculationResultId: Types.ObjectId;
  changes: ISceanarioChange[];
  projectedTotalKg: number;
  savingsKg: number;
  createdAt: Date;
}

const WhatIfScenarioSchema = new Schema<IWhatIfScenario>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  baseCalculationResultId: { type: Schema.Types.ObjectId, ref: 'CalculationResult', required: true },
  changes: [{
    activityType: { type: String, required: true, enum: ['electricity', 'diesel', 'roadTransport', 'rawMaterial'] },
    adjustmentType: { type: String, required: true },
    adjustmentPct: { type: Number, required: true }
  }],
  projectedTotalKg: { type: Number, required: true },
  savingsKg: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const WhatIfScenario = model<IWhatIfScenario>('WhatIfScenario', WhatIfScenarioSchema, 'whatIfScenarios');
