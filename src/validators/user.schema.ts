import { z } from 'zod';
import { ROLES } from '../constants/roles';

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES),
  phone: z.string().trim().max(30).default(''),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.email().trim().toLowerCase().optional(),
  password: z.string().min(8).optional(),
  phone: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
});
