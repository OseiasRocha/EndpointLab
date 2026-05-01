import HttpStatusCodes from '../common/constants/HttpStatusCodes';
import { RouteError } from '../common/utils/route-errors';
import { IEndpoint, EndpointInput } from '../schemas/endpointSchema';
import EndpointRepo from '../repos/EndpointRepo';
import WsManager from './WebSocketManager';

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
  const endpoint = EndpointRepo.add(data);
  WsManager.track(endpoint);
  return endpoint;
}

function upsertMany(data: EndpointInput[]): { created: IEndpoint[]; updated: IEndpoint[] } {
  const before = EndpointRepo.getAll();
  const result = EndpointRepo.bulkUpsert(data);
  for (const updated of result.updated) {
    const old = before.find(e => e.id === updated.id);
    if (old) WsManager.untrack(old);
    WsManager.track(updated);
  }
  for (const created of result.created) {
    WsManager.track(created);
  }
  return result;
}

function updateOne(id: number, data: EndpointInput): IEndpoint {
  const existing = EndpointRepo.getById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  const endpoint = EndpointRepo.update(id, { ...data, externalId: data.externalId ?? existing.externalId });
  WsManager.untrack(existing);
  WsManager.track(endpoint);
  return endpoint;
}

function deleteOne(id: number): void {
  const existing = EndpointRepo.getById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  EndpointRepo.delete(id);
  WsManager.untrack(existing);
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
