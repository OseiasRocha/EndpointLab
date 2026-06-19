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

async function addOne(data: EndpointInput): Promise<IEndpoint> {
  const endpoint = EndpointRepo.add(data);
  try {
    await WsManager.track(endpoint);
  } catch (err) {
    EndpointRepo.delete(endpoint.id);
    throw err;
  }
  return endpoint;
}

async function upsertMany(data: EndpointInput[]): Promise<{ created: IEndpoint[]; updated: IEndpoint[] }> {
  const before = EndpointRepo.getAll();
  const result = EndpointRepo.bulkUpsert(data);
  for (const updated of result.updated) {
    const old = before.find(e => e.id === updated.id);
    if (old) await WsManager.untrack(old);
    await WsManager.track(updated);
  }
  for (const created of result.created) {
    await WsManager.track(created);
  }
  return result;
}

async function updateOne(id: number, data: EndpointInput): Promise<IEndpoint> {
  const existing = EndpointRepo.getById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  const endpoint = EndpointRepo.update(id, { ...data, externalId: data.externalId ?? existing.externalId });
  await WsManager.untrack(existing);
  await WsManager.track(endpoint);
  return endpoint;
}

function reorder(orderedIds: number[]): void {
  EndpointRepo.reorder(orderedIds);
}

async function deleteOne(id: number): Promise<void> {
  const existing = EndpointRepo.getById(id);
  if (!existing) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, Errors.NOT_FOUND);
  }
  EndpointRepo.delete(id);
  await WsManager.untrack(existing);
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
  reorder,
  delete: deleteOne,
} as const;
