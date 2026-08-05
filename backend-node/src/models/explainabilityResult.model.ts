import { Schema, model, Document, Types } from 'mongoose';

export interface IExplainabilityFactor {
  feature: string;
  contributionPct: number;
  plainLanguage: string;
}

export interface IExplainabilityResult extends Document {
  calculationResultId: Types.ObjectId;
  topFactors: IExplainabilityFactor[];
  createdAt: Date;
}

const ExplainabilityResultSchema = new Schema<IExplainabilityResult>({
  calculationResultId: { type: Schema.Types.ObjectId, ref: 'CalculationResult', required: true },
  topFactors: [{
    feature: { type: String, required: true },
    contributionPct: { type: Number, required: true },
    plainLanguage: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const ExplainabilityResult = model<IExplainabilityResult>('ExplainabilityResult', ExplainabilityResultSchema, 'explainabilityResults');
