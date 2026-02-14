import { z } from 'zod';

// Username validation: lowercase letters only, 3-50 characters
const usernameSchema = z
  .string({
    message: 'Username must be a string',
  })
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[a-z]+$/, 'Username must contain only lowercase letters');

// Password validation: min 8 chars, must contain uppercase, lowercase, number, and symbol
const passwordSchema = z
  .string({
    message: 'Password must be a string',
  })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    'Password must contain at least one special character'
  );

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
export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

// Reset password form schema
export const resetPasswordSchema = z.object({
  username: usernameSchema,
  recoveryKey: z
    .string({
      message: 'Recovery key must be a string',
    })
    .min(1, 'Recovery key is required'),
  newPassword: passwordSchema,
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
