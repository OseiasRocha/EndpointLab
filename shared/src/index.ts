import { z } from 'zod';
export { getEndpointFallbackKey, getEndpointImportKey } from './endpointIdentity';

/******************************************************************************
                             Primitive Schemas
******************************************************************************/

export const ProtocolSchema = z.enum(['HTTP', 'TCP', 'UDP']);
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

/******************************************************************************
                             Endpoint Schemas
******************************************************************************/

const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((v) => v ?? undefined);

export const EndpointSchema = z
  .object({
    externalId: nullToUndefined(z.string().uuid()),
    name: z.string().min(1, 'Name is required'),
    description: nullToUndefined(z.string()),
    protocol: ProtocolSchema,
    host: z.string().min(1, 'Host is required'),
    port: z.number().int().min(1).max(65535),
    httpMethod: nullToUndefined(HttpMethodSchema),
    path: nullToUndefined(z.string()),
    requestBody: nullToUndefined(z.string()),
    hasResponse: z.boolean(),
    responseBody: nullToUndefined(z.string()),
    group: nullToUndefined(z.string()),
  })
  .refine(
    (data) => {
      if (data.protocol === 'HTTP') {
        return !!data.httpMethod && !!data.path;
      }
      return true;
    },
    {
      message: 'httpMethod and path are required for HTTP protocol',
      path: ['httpMethod'],
    },
  );

export const EndpointWithIdSchema = EndpointSchema.extend({
  id: z.number().int().positive(),
});

/** Frontend-friendly schema where id is optional (used before creation) */
export const SimulatorEndpointSchema = EndpointSchema.extend({
  id: z.number().int().positive().optional(),
});

/******************************************************************************
                             Transmit Schema
******************************************************************************/

export const TransmitResultSchema = z.object({
  success: z.boolean(),
  responseBody: z.string().optional(),
  error: z.string().optional(),
  latencyMs: z.number(),
});

/******************************************************************************
                             Derived Types
******************************************************************************/

export type Protocol = z.infer<typeof ProtocolSchema>;
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/** Backend input type (no id) */
export type EndpointInput = z.infer<typeof EndpointSchema>;

/** Backend response type (id required) */
export type IEndpoint = z.infer<typeof EndpointWithIdSchema>;

/** Frontend endpoint type (id optional) */
export type SimulatorEndpoint = z.infer<typeof SimulatorEndpointSchema>;

export type TransmitResult = z.infer<typeof TransmitResultSchema>;
