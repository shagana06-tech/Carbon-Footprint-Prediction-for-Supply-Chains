import { Schema, model, Document, Types } from 'mongoose';

export interface IRawEntrySummary {
  activityType: string;
  quantity: number;
  unit: string;
  region: string;
  equipmentAgeYears?: number;
  cargoWeightTons?: number;
  supplierId?: string;
  baselineKg?: number;
}

export interface IPredictionLog extends Document {
  companyId: Types.ObjectId;
  period: string; // YYYY-MM
  triggerType: 'manual_entry' | 'bulk_upload' | 'demo_seed' | 'recalculation';
  timestamp: Date;
  prePredictionBaseline: {
    scope1Kg: number;
    scope2Kg: number;
    scope3Kg: number;
    totalKg: number;
    entryCount: number;
    rawEntries: IRawEntrySummary[];
  };
  postPredictionModel: {
    correctedTotalKg: number;
    scope1Kg: number;
    scope2Kg: number;
    scope3Kg: number;
    deltaKg: number;
    deltaPct: number;
    modelVersion: string;
    topFactors: Array<{
      feature: string;
      contributionPct: number;
      plainLanguage: string;
    }>;
    breakdown: Array<{
      activityType: string;
      kg: number;
      pct: number;
    }>;
  };
}

const PredictionLogSchema = new Schema<IPredictionLog>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  period: { type: String, required: true },
  triggerType: { 
    type: String, 
    enum: ['manual_entry', 'bulk_upload', 'demo_seed', 'recalculation'], 
    default: 'recalculation' 
  },
  timestamp: { type: Date, default: Date.now },
  prePredictionBaseline: {
    scope1Kg: { type: Number, default: 0 },
    scope2Kg: { type: Number, default: 0 },
    scope3Kg: { type: Number, default: 0 },
    totalKg: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },
    rawEntries: [{
      activityType: String,
      quantity: Number,
      unit: String,
      region: String,
      equipmentAgeYears: Number,
      cargoWeightTons: Number,
      supplierId: String,
      baselineKg: Number
    }]
  },
  postPredictionModel: {
    correctedTotalKg: { type: Number, default: 0 },
    scope1Kg: { type: Number, default: 0 },
    scope2Kg: { type: Number, default: 0 },
    scope3Kg: { type: Number, default: 0 },
    deltaKg: { type: Number, default: 0 },
    deltaPct: { type: Number, default: 0 },
    modelVersion: { type: String, default: '1.0.0' },
    topFactors: [{
      feature: String,
      contributionPct: Number,
      plainLanguage: String
    }],
    breakdown: [{
      activityType: String,
      kg: Number,
      pct: Number
    }]
  }
});

PredictionLogSchema.index({ companyId: 1, timestamp: -1 });

export const PredictionLog = model<IPredictionLog>('PredictionLog', PredictionLogSchema, 'predictionLogs');
