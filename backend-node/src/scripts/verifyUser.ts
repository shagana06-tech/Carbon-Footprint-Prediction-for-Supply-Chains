import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/user.model';
import { Company } from '../models/company.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  // Touch Company model so Mongoose registers the schema
  const companyCount = await Company.countDocuments();
  const user = await User.findOne({ email: 'shaganasundar9@gmail.com' }).populate('companyId');
  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }
  const isMatch = await bcrypt.compare('wannabeme', user.passwordHash);
  console.log('✓ Found User:', user.email);
  console.log('✓ Company Name:', (user.companyId as any).name);
  console.log('✓ Password Match:', isMatch);
  console.log('✓ User Role:', user.role);
  await mongoose.disconnect();
}

verify();
