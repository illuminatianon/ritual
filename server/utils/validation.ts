import { createError, getRouterParam } from 'h3';
import { z } from 'zod';

export const songNameSchema = z.object({
  name: z.string().trim().max(200),
});

export const versionCreateSchema = z.object({
  lyrics: z.string(),
  label: z.string().trim().max(200).optional(),
});

export const versionUpdateSchema = z.object({
  lyrics: z.string(),
});


const styleMetadataSchema = z.record(z.string(), z.unknown()).optional();

export const styleCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  positive_prompt: z.string().trim().min(1).max(1_000),
  negative_prompt: z.string().trim().max(1_000).optional().default(''),
  metadata: styleMetadataSchema,
});

export const styleVersionCreateSchema = styleCreateSchema;

export const styleGenerateSchema = z.object({
  request: z.string().trim().min(1).max(2_000),
});

export const styleRefineSchema = z.object({
  positive_prompt: z.string().trim().min(1).max(1_000),
  negative_prompt: z.string().trim().max(1_000).optional().default(''),
  instruction: z.string().trim().min(1).max(2_000),
});
const uuidSchema = z.uuid();

export function parseUuidParam(event: Parameters<typeof getRouterParam>[0], name: string) {
  const value = getRouterParam(event, name);
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}.` });
  }
  return result.data;
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body.' });
  }
  return result.data;
}
