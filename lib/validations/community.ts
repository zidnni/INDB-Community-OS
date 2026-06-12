import {z} from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerSchema = z
  .object({
    username: z.string().min(3).max(24),
    email: z.email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export const createPostSchema = z.object({
  content: z.string().min(2).max(2800),
  categoryId: z.coerce.number().int().positive().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(2).max(1200),
});

export const profileSchema = z.object({
  username: z.string().min(3).max(24),
  fullName: z.string().min(2).max(100),
  bio: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  hometown: z.string().max(100).optional().or(z.literal("")),
  languagesSpoken: z.string().max(500).optional().or(z.literal("")),
  languagePreference: z.string().max(10).optional().or(z.literal("")),
  avatarUrl: z.string().optional().or(z.literal("")),
  coverImageUrl: z.string().optional().or(z.literal("")),
});

export const memorySchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().min(1).max(5000),
  decade: z.string().max(60).optional().or(z.literal("")),
  year: z.string().optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  category: z.string().max(60).optional().or(z.literal("")),
  tags: z.string().optional().or(z.literal("")),
});

export const ideaSchema = z.object({
  title: z.string().min(4).max(150),
  description: z.string().min(10).max(5000),
  categoryId: z.coerce.number().int().positive().optional(),
});

export const communityShareSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().min(2).max(2500),
  category: z.enum(["food", "clothes", "furniture", "electronics", "school_supplies", "books", "services", "other"]),
  condition: z.string().max(120).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
});


