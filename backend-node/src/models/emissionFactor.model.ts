import { Schema, model, Document } from 'mongoose';

export interface IEmissionFactor extends Document {
  activityType: 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
  region: string;
  unit: string;
  factorValue: number; // kg CO2e per unit
  scope: 1 | 2 | 3;
  source: 'climatiq' | 'local-seed';
  updatedAt: Date;
}

const EmissionFactorSchema = new Schema<IEmissionFactor>({
  activityType: { 
    type: String, 
    required: true, 
    enum: ['electricity', 'diesel', 'roadTransport', 'rawMaterial'] 
  },
  region: { type: String, required: true },
  unit: { type: String, required: true },
  factorValue: { type: Number, required: true },
  scope: { type: Number, required: true, enum: [1, 2, 3] },
  source: { type: String, required: true, enum: ['climatiq', 'local-seed'] },
  updatedAt: { type: Date, default: Date.now }
});

export const EmissionFactor = model<IEmissionFactor>('EmissionFactor', EmissionFactorSchema, 'emissionFactors');
