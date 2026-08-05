import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityEntry extends Document {
  companyId: Types.ObjectId;
  period: string; // YYYY-MM
  activityType: 'electricity' | 'diesel' | 'roadTransport' | 'rawMaterial';
  quantity: number;
  unit: string;
  region: string;
  equipmentAgeYears?: number;
  cargoWeightTons?: number;
  supplierId?: string;
  createdAt: Date;
}

const ActivityEntrySchema = new Schema<IActivityEntry>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  period: { 
    type: String, 
    required: true, 
    validate: {
      validator: (v: string) => /^\d{4}-\d{2}$/.test(v),
      message: (props: any) => `${props.value} is not a valid period format (YYYY-MM)!`
    }
  },
  activityType: { 
    type: String, 
    required: true, 
    enum: ['electricity', 'diesel', 'roadTransport', 'rawMaterial'] 
  },
  quantity: { type: Number, required: true, min: [0.0001, 'Quantity must be greater than zero'] },
  unit: { type: String, required: true },
  region: { type: String, required: true },
  equipmentAgeYears: { type: Number, min: 0 },
  cargoWeightTons: { 
    type: Number, 
    validate: {
      validator: function(this: any, v: number) {
        if (this.activityType === 'roadTransport') {
          return typeof v === 'number' && v > 0;
        }
        return true;
      },
      message: 'cargoWeightTons is required and must be greater than 0 when activityType is roadTransport!'
    }
  },
  supplierId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Compound index on companyId and period
ActivityEntrySchema.index({ companyId: 1, period: 1 });

export const ActivityEntry = model<IActivityEntry>('ActivityEntry', ActivityEntrySchema, 'activityEntries');
