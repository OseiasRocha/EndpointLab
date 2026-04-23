import { ZodError } from 'zod';

import HttpStatusCodes from '../common/constants/HttpStatusCodes';
import { RouteError } from '../common/utils/route-errors';
import { EndpointSchema } from '../schemas/endpointSchema';
import EndpointService from '../services/EndpointService';

import { Req, Res } from './common/express-types';

/******************************************************************************
                                Functions
******************************************************************************/

/**
 * Get all endpoints.
 *
 * @route GET /api/endpoints
 */
function getAll(_: Req, res: Res) {
  const endpoints = EndpointService.getAll();
  res.status(HttpStatusCodes.OK).json(endpoints);
}

/**
 * Create one endpoint.
 *
 * @route POST /api/endpoints
 */
function create(req: Req, res: Res) {
  const result = EndpointSchema.safeParse(req.body);
  if (!result.success) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      formatZodError(result.error),
    );
  }
  const endpoint = EndpointService.addOne(result.data);
  res.status(HttpStatusCodes.CREATED).json(endpoint);
}

/**
 * Update one endpoint.
 *
 * @route PUT /api/endpoints/:id
 */
function update(req: Req, res: Res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid id');
  }
  const result = EndpointSchema.safeParse(req.body);
  if (!result.success) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      formatZodError(result.error),
    );
  }
  const endpoint = EndpointService.updateOne(id, result.data);
  res.status(HttpStatusCodes.OK).json(endpoint);
}

/**
 * Bulk-create endpoints (used by import).
 *
 * @route POST /api/endpoints/bulk
 */
function bulkCreate(req: Req, res: Res) {
  if (!Array.isArray(req.body)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Body must be an array');
  }
  const parsed: ReturnType<typeof EndpointSchema.safeParse>[] = req.body.map(
    (item: unknown) => EndpointSchema.safeParse(item),
  );
  const failed = parsed.filter(r => !r.success);
  if (failed.length > 0) {
    const msgs = failed
      .map(r => (!r.success ? formatZodError(r.error) : ''))
      .filter(Boolean)
      .join(' | ');
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, msgs);
  }
  const data = parsed.map(r => (r.success ? r.data : null)).filter(Boolean) as ReturnType<typeof EndpointSchema.parse>[];
  const result = EndpointService.upsertMany(data);
  res.status(HttpStatusCodes.OK).json(result);
}

/**
 * Delete one endpoint.
 *
 * @route DELETE /api/endpoints/:id
 */
function delete_(req: Req, res: Res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid id');
  }
  EndpointService.delete(id);
  res.status(HttpStatusCodes.OK).end();
}

/******************************************************************************
                                Helpers
******************************************************************************/

function formatZodError(error: ZodError): string {
  return error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
}

/******************************************************************************
                                Export default
******************************************************************************/

export default {
  getAll,
  create,
  bulkCreate,
  update,
  delete: delete_,
} as const;
