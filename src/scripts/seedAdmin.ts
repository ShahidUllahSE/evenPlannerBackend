// Creates the first admin account from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD.
// Safe to run again: an existing account with that email is left untouched.
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { UserModel } from '../models/User.model';
import { hashPassword } from '../services/user.service';

const run = async () => {
  const name = process.env.ADMIN_NAME ?? 'Admin User';
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env');
  }

  await connectDB();
  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists (role: ${existing.role}); nothing to do.`);
  } else {
    await UserModel.create({ name, email, role: 'admin', passwordHash: await hashPassword(password) });
    console.log(`Admin created: ${email}`);
  }
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
