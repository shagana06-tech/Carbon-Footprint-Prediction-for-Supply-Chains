import { Schema, model, Document, Types } from 'mongoose';

export interface IBreakdownItem {
  activityType: 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
  kg: number;
  pct: number;
}

export interface ICalculationResult extends Document {
  companyId: Types.ObjectId;
  period: string; // YYYY-MM
  scope1Kg: number;
  scope2Kg: number;
  scope3Kg: number;
  totalKg: number;
  baselineTotalKg: number;
  correctedTotalKg: number;
  breakdown: IBreakdownItem[];
  modelVersion: string;
  createdAt: Date;
}

const CalculationResultSchema = new Schema<ICalculationResult>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  period: { 
    type: String, 
    required: true, 
    validate: {
      validator: (v: string) => /^\d{4}-\d{2}$/.test(v),
      message: (props: any) => `${props.value} is not a valid period format (YYYY-MM)!`
    }
  },
  scope1Kg: { type: Number, required: true, default: 0 },
  scope2Kg: { type: Number, required: true, default: 0 },
  scope3Kg: { type: Number, required: true, default: 0 },
  totalKg: { type: Number, required: true, default: 0 },
  baselineTotalKg: { type: Number, required: true, default: 0 },
  correctedTotalKg: { type: Number, required: true, default: 0 },
  breakdown: [{
    activityType: { type: String, required: true, enum: ['electricity', 'diesel', 'roadTransport', 'rawMaterial'] },
    kg: { type: Number, required: true },
    pct: { type: Number, required: true }
  }],
  modelVersion: { type: String, required: true, default: '1.0.0' },
  createdAt: { type: Date, default: Date.now }
});

// Compound index on companyId and period
CalculationResultSchema.index({ companyId: 1, period: 1 });

export const CalculationResult = model<ICalculationResult>('CalculationResult', CalculationResultSchema, 'calculationResults');
