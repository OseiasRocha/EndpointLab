import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import db from '../db';
import { endpoints } from '../db/schema';
import {
  EndpointInput,
  getEndpointFallbackKey,
  getEndpointImportKey,
  IEndpoint,
} from '../schemas/endpointSchema';

/******************************************************************************
                                Functions
******************************************************************************/

function getAll(): IEndpoint[] {
  return db.select().from(endpoints).all() as IEndpoint[];
}

function getById(id: number): IEndpoint | null {
  return (db.select().from(endpoints).where(eq(endpoints.id, id)).get() ?? null) as IEndpoint | null;
}

function persists(id: number): boolean {
  return !!db.select({ id: endpoints.id }).from(endpoints).where(eq(endpoints.id, id)).get();
}

function add(data: EndpointInput): IEndpoint {
  return db.insert(endpoints).values(toRow(data)).returning().get() as IEndpoint;
}

function bulkUpsert(data: EndpointInput[]): { created: IEndpoint[]; updated: IEndpoint[] } {
  const created: IEndpoint[] = [];
  const updated: IEndpoint[] = [];
  const existing = getAll();
  const byImportKey = new Map(existing.map((item) => [getEndpointImportKey(item), item]));
  const byFallbackKey = new Map(existing.map((item) => [getEndpointFallbackKey(item), item]));

  for (const item of data) {
    const match = item.externalId
      ? byImportKey.get(getEndpointImportKey(item))
      : byFallbackKey.get(getEndpointFallbackKey(item));

    if (match) {
      const previousImportKey = getEndpointImportKey(match);
      const previousFallbackKey = getEndpointFallbackKey(match);
      const up = db.update(endpoints)
        .set(toRow(item, match.externalId))
        .where(eq(endpoints.id, match.id))
        .returning()
        .get() as IEndpoint;
      updated.push(up);
      byImportKey.delete(previousImportKey);
      byFallbackKey.delete(previousFallbackKey);
      byImportKey.set(getEndpointImportKey(up), up);
      byFallbackKey.set(getEndpointFallbackKey(up), up);
    } else {
      const cr = db.insert(endpoints).values(toRow(item)).returning().get() as IEndpoint;
      created.push(cr);
      byImportKey.set(getEndpointImportKey(cr), cr);
      byFallbackKey.set(getEndpointFallbackKey(cr), cr);
    }
  }
  return { created, updated };
}

function update(id: number, data: EndpointInput): IEndpoint {
  const existing = getById(id);
  const externalId = data.externalId ?? existing?.externalId;
  return db.update(endpoints)
    .set(toRow(data, externalId))
    .where(eq(endpoints.id, id))
    .returning()
    .get() as IEndpoint;
}

function delete_(id: number): void {
  db.delete(endpoints).where(eq(endpoints.id, id)).run();
}

/** Map EndpointInput → DB column names */
function toRow(data: EndpointInput, fallbackExternalId?: string) {
  return {
    externalId: data.externalId ?? fallbackExternalId ?? randomUUID(),
    name: data.name,
    description: data.description ?? null,
    protocol: data.protocol,
    host: data.host,
    port: data.port,
    httpMethod: data.httpMethod ?? null,
    path: data.path ?? null,
    requestBody: data.requestBody ?? null,
    hasResponse: data.hasResponse,
    responseBody: data.responseBody ?? null,
    group: data.group ?? null,
  };
}

/******************************************************************************
                                Export default
******************************************************************************/

export default {
  getAll,
  getById,
  persists,
  add,
  bulkUpsert,
  update,
  delete: delete_,
} as const;
