import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { Company } from '../models/company.model';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_carbon_key_final_year';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, companyName, industry, country } = req.body;

    if (!email || !password || !companyName || !industry || !country) {
      return res.status(400).json({ 
        error: 'ValidationError', 
        detail: 'Email, password, companyName, industry, and country are required.' 
      });
    }

    // Normalize email to lowercase before storing
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'ConflictError', 
        detail: 'A user with this email address already exists.' 
      });
    }

    // 1. Create the company
    const company = new Company({
      name: companyName,
      industry,
      country
    });
    await company.save();

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create the admin user
    const user = new User({
      email: normalizedEmail,
      passwordHash,
      companyId: company._id,
      role: 'admin'
    });
    await user.save();

    // 4. Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, companyId: company._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        companyId: company._id,
        role: user.role
      }
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'ValidationError', 
        detail: 'Email and password are required.' 
      });
    }

    // Normalize email to lowercase to match schema (lowercase: true)
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ 
        error: 'AuthenticationError', 
        detail: 'Invalid email or password.' 
      });
    }

    if (!user.passwordHash) {
      return res.status(500).json({ 
        error: 'InternalServerError', 
        detail: 'User account is corrupted. Please contact support.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'AuthenticationError', 
        detail: 'Invalid email or password.' 
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, companyId: user.companyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        companyId: user.companyId,
        role: user.role
      }
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', detail: err.message });
  }
};
