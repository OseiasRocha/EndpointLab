import { ZodError } from 'zod';

import HttpStatusCodes from '@src/common/constants/HttpStatusCodes';
import { RouteError } from '@src/common/utils/route-errors';
import { EndpointSchema } from '@src/schemas/endpointSchema';
import EndpointService from '@src/services/EndpointService';

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
  update,
  delete: delete_,
} as const;
