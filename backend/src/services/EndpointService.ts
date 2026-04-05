import HttpStatusCodes from '@src/common/constants/HttpStatusCodes';
import { RouteError } from '@src/common/utils/route-errors';
import { IEndpoint, EndpointInput } from '@src/schemas/endpointSchema';
import EndpointRepo from '@src/repos/EndpointRepo';

/******************************************************************************
                                Constants
******************************************************************************/

const Errors = {
  NOT_FOUND: 'Endpoint not found',
} as const;

/******************************************************************************
                                Functions
******************************************************************************/

function getAll(): IEndpoint[] {
  return EndpointRepo.getAll();
}

function addOne(data: EndpointInput): IEndpoint {
  return EndpointRepo.add(data);
}

function updateOne(id: number, data: EndpointInput): IEndpoint {
  if (!EndpointRepo.persists(id)) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  return EndpointRepo.update(id, data);
}

function deleteOne(id: number): void {
  if (!EndpointRepo.persists(id)) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  EndpointRepo.delete(id);
}

/******************************************************************************
                                Export default
******************************************************************************/

export default {
  Errors,
  getAll,
  addOne,
  updateOne,
  delete: deleteOne,
} as const;