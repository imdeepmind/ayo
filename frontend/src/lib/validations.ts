import { z } from 'zod';

// Username validation: letters, numbers, underscores, hyphens; 3-50 characters
const usernameSchema = z
  .string({
    message: 'Username must be a string',
  })
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  );

// Password validation: min 8 chars; strength is enforced by the backend
// (entropy-based "password_strength" rule)
const passwordSchema = z
  .string({
    message: 'Password must be a string',
  })
  .min(8, 'Password must be at least 8 characters');

// Login form schema
export const loginSchema = z.object({
  username: usernameSchema,
  password: z
    .string({
      message: 'Password must be a string',
    })
    .min(1, 'Password is required'),
});

// Register form schema
export const registerSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Reset password form schema
export const resetPasswordSchema = z
  .object({
    username: usernameSchema,
    recoveryKey: z
      .string({
        message: 'Recovery key must be a string',
      })
      .min(1, 'Recovery key is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Account action schema (change password, delete account, delete data)
export const accountActionSchema = z
  .object({
    password: z.string({ message: 'Password must be a string' }).min(1, 'Password is required'),
    recoveryKey: z
      .string({ message: 'Recovery key must be a string' })
      .min(1, 'Recovery key is required'),
    newPassword: z.string().optional(),
    confirmNewPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      // If newPassword is provided, it must meet strength requirements
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword.length >= 8;
      }
      return true;
    },
    { message: 'New password must be at least 8 characters', path: ['newPassword'] }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword === data.confirmNewPassword;
      }
      return true;
    },
    { message: 'Passwords do not match', path: ['confirmNewPassword'] }
  );

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type AccountActionFormData = z.infer<typeof accountActionSchema>;
