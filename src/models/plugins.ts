/** Shared options: timestamps, and JSON that matches the frontend (`id` instead of `_id`). */
export const baseOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
} as const;
