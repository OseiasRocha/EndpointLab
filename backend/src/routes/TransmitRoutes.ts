import HttpStatusCodes from '@src/common/constants/HttpStatusCodes';
import { RouteError } from '@src/common/utils/route-errors';
import EndpointRepo from '@src/repos/EndpointRepo';
import TransmitService from '@src/services/TransmitService';

import { Req, Res } from './common/express-types';

/******************************************************************************
                                Functions
******************************************************************************/

/**
 * Transmit a message to an endpoint and return the result.
 *
 * @route POST /api/endpoints/:id/send
 */
async function send(req: Req, res: Res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid id');
  }

  const endpoint = EndpointRepo.getById(id);
  if (!endpoint) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Endpoint not found');
  }

  const result = await TransmitService.transmit(endpoint);
  res.status(HttpStatusCodes.OK).json(result);
}

/******************************************************************************
                                Export default
******************************************************************************/

export default { send } as const;