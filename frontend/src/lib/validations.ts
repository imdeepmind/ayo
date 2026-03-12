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
        return /[A-Z]/.test(data.newPassword);
      }
      return true;
    },
    {
      message: 'New password must contain at least one uppercase letter',
      path: ['newPassword'],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return /[a-z]/.test(data.newPassword);
      }
      return true;
    },
    {
      message: 'New password must contain at least one lowercase letter',
      path: ['newPassword'],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return /[0-9]/.test(data.newPassword);
      }
      return true;
    },
    { message: 'New password must contain at least one number', path: ['newPassword'] }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(data.newPassword);
      }
      return true;
    },
    {
      message: 'New password must contain at least one special character',
      path: ['newPassword'],
    }
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
