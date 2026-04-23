import HttpStatusCodes from '../common/constants/HttpStatusCodes';
import { RouteError } from '../common/utils/route-errors';
import { IEndpoint, EndpointInput } from '../schemas/endpointSchema';
import EndpointRepo from '../repos/EndpointRepo';

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

function upsertMany(data: EndpointInput[]): { created: IEndpoint[]; updated: IEndpoint[] } {
  return EndpointRepo.bulkUpsert(data);
}

function updateOne(id: number, data: EndpointInput): IEndpoint {
  const existing = EndpointRepo.getById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  return EndpointRepo.update(id, { ...data, externalId: data.externalId ?? existing.externalId });
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
  upsertMany,
  updateOne,
  delete: deleteOne,
} as const;
