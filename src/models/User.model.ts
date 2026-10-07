import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType, type Types } from 'mongoose';
import { ROLES } from '../constants/roles';
import { baseOptions } from './plugins';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    phone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    /** Who created this account (admin, or the planner who owns this scanner). */
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date, default: null },
  },
  baseOptions,
);

userSchema.index({ role: 1, createdBy: 1 });

export type User = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserDoc = HydratedDocumentFromSchema<typeof userSchema>;
export const UserModel = model('User', userSchema);
