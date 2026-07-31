import { z } from 'zod';

const email = z
  .string({ error: 'Email ID is required.' })
  .trim()
  .min(1, 'Email ID is required.')
  .max(254, 'Email ID must not exceed 254 characters.')
  .email('Enter a valid Email ID.')
  .transform((value) => value.toLowerCase());

const password = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must not exceed 72 characters.');

export const registerCompanySchema = z.object({
  companyName: z
    .string({ error: 'Company Name is required.' })
    .trim()
    .min(2, 'Company Name must be at least 2 characters.')
    .max(100, 'Company Name must not exceed 100 characters.'),
  referralCode: z.string().trim().max(20).optional().or(z.literal('')),
  fullName: z
    .string({ error: 'Full Name is required.' })
    .trim()
    .min(2, 'Full Name must be at least 2 characters.')
    .max(100, 'Full Name must not exceed 100 characters.')
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, 'Full Name must contain letters only.'),
  email,
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Enter a valid Contact Number.')
    .optional()
    .or(z.literal('')),
  country: z
    .string()
    .trim()
    .length(2, 'Country must be a 2-letter code.')
    .transform((value) => value.toUpperCase())
    .optional(),
  password
});

export const logInSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.')
});

export const selectCompanySchema = z.object({
  preAuthToken: z.string({ error: 'Your session has expired. Please log in again.' }),
  companyId: z.string({ error: 'Company is required.' }).uuid('Company is required.')
});

export const switchCompanySchema = z.object({
  companyId: z.string({ error: 'Company is required.' }).uuid('Company is required.')
});

export const updateProfileSchema = z.object({
  fullName: z
    .string({ error: 'Full Name is required.' })
    .trim()
    .min(2, 'Full Name must be at least 2 characters.')
    .max(100, 'Full Name must not exceed 100 characters.')
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, 'Full Name must contain letters only.'),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Enter a valid Contact Number.')
    .optional()
    .or(z.literal(''))
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'This reset link is invalid or has expired. Please request a new one.' })
    .min(10, 'This reset link is invalid or has expired. Please request a new one.'),
  newPassword: password
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Current Password is required.' })
      .min(1, 'Current Password is required.'),
    newPassword: password
  })
  .superRefine((data, context) => {
    if (data.currentPassword === data.newPassword) {
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'New Password must be different from the current password.'
      });
    }
  });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type LogInInput = z.infer<typeof logInSchema>;
export type SelectCompanyInput = z.infer<typeof selectCompanySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
