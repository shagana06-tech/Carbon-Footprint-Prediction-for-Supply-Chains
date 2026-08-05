import { Schema, model, Document, Types } from 'mongoose';

export interface IReport extends Document {
  companyId: Types.ObjectId;
  period: string; // YYYY-MM
  format: 'BRSR' | 'CSRD';
  fileName: string;
  generatedAt: Date;
}

const ReportSchema = new Schema<IReport>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  period: { 
    type: String, 
    required: true,
    validate: {
      validator: (v: string) => /^\d{4}-\d{2}$/.test(v),
      message: (props: any) => `${props.value} is not a valid period format (YYYY-MM)!`
    }
  },
  format: { type: String, required: true, enum: ['BRSR', 'CSRD'] },
  fileName: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now }
});

export const Report = model<IReport>('Report', ReportSchema, 'reports');
