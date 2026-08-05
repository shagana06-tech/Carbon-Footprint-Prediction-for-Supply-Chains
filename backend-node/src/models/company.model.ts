import { Schema, model, Document } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  industry: string;
  country: string;
  createdAt: Date;
}

const CompanySchema = new Schema<ICompany>({
  name: { type: String, required: true },
  industry: { type: String, required: true },
  country: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Company = model<ICompany>('Company', CompanySchema, 'companies');
