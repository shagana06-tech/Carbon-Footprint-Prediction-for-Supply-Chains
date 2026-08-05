import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/user.model';
import { Company } from '../models/company.model';
import { EmissionFactor } from '../models/emissionFactor.model';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';

async function seedDatabase() {
  console.log('Connecting to MongoDB Atlas...');
  console.log('URI:', MONGO_URI.replace(/:([^:@]+)@/, ':***@'));

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Successfully connected to MongoDB Atlas database!');

    // 1. Create or Find Company
    let company = await Company.findOne({ name: 'Global Carbon Systems' });
    if (!company) {
      company = new Company({
        name: 'Global Carbon Systems',
        industry: 'Technology',
        country: 'India'
      });
      await company.save();
      console.log('✓ Created Company:', company.name, `(ID: ${company._id})`);
    } else {
      console.log('✓ Found existing Company:', company.name, `(ID: ${company._id})`);
    }

    // 2. Hash Password and Create/Update User Account
    const targetEmail = 'shaganasundar9@gmail.com';
    const rawPassword = 'wannabeme';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    let user = await User.findOne({ email: targetEmail });
    if (user) {
      user.passwordHash = passwordHash;
      user.companyId = company._id;
      user.role = 'admin';
      await user.save();
      console.log('✓ Updated existing User Account:', user.email);
    } else {
      user = new User({
        email: targetEmail,
        passwordHash,
        companyId: company._id,
        role: 'admin'
      });
      await user.save();
      console.log('✓ Created User Account:', user.email);
    }

    // Validate password verification
    const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);
    if (isMatch) {
      console.log('✓ Password verification validated successfully for', user.email);
    } else {
      console.error('✗ Password verification failed!');
    }

    // 3. Seed Emission Factors
    const initialFactors = [
      { activityType: 'electricity', region: 'India', unit: 'kWh', factorValue: 0.82, scope: 2, source: 'local-seed' },
      { activityType: 'electricity', region: 'Global', unit: 'kWh', factorValue: 0.475, scope: 2, source: 'local-seed' },
      { activityType: 'diesel', region: 'India', unit: 'liters', factorValue: 2.68, scope: 1, source: 'local-seed' },
      { activityType: 'roadTransport', region: 'India', unit: 'km', factorValue: 0.17, scope: 3, source: 'local-seed' },
      { activityType: 'rawMaterial', region: 'Global', unit: 'kg', factorValue: 1.85, scope: 3, source: 'local-seed' }
    ];

    for (const factor of initialFactors) {
      await EmissionFactor.findOneAndUpdate(
        { activityType: factor.activityType, region: factor.region, unit: factor.unit },
        { ...factor, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    console.log('✓ Seeded emission factors for electricity, diesel, roadTransport, rawMaterial');

    console.log('\n=============================================');
    console.log('DATABASE INITIALIZATION COMPLETE & VALIDATED');
    console.log('=============================================');
    console.log('Database URL:', MONGO_URI.replace(/:([^:@]+)@/, ':***@'));
    console.log('Admin Email:', user.email);
    console.log('Admin Password:', rawPassword);
    console.log('User Role:', user.role);
    console.log('Company ID:', company._id.toString());
    console.log('=============================================\n');

  } catch (err: any) {
    console.error('Error seeding database:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedDatabase();
