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
