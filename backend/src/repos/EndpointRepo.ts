import { and, eq } from 'drizzle-orm';

import db from '../db';
import { endpoints } from '../db/schema';
import { IEndpoint, EndpointInput } from '../schemas/endpointSchema';

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

function findByNameHostPort(name: string, host: string, port: number): IEndpoint | null {
  return (db.select().from(endpoints)
    .where(and(eq(endpoints.name, name), eq(endpoints.host, host), eq(endpoints.port, port)))
    .get() ?? null) as IEndpoint | null;
}

function bulkUpsert(data: EndpointInput[]): { created: IEndpoint[]; updated: IEndpoint[] } {
  const created: IEndpoint[] = [];
  const updated: IEndpoint[] = [];
  for (const item of data) {
    const existing = findByNameHostPort(item.name, item.host, item.port);
    if (existing) {
      const up = db.update(endpoints).set(toRow(item)).where(eq(endpoints.id, existing.id)).returning().get() as IEndpoint;
      updated.push(up);
    } else {
      const cr = db.insert(endpoints).values(toRow(item)).returning().get() as IEndpoint;
      created.push(cr);
    }
  }
  return { created, updated };
}

function update(id: number, data: EndpointInput): IEndpoint {
  return db.update(endpoints).set(toRow(data)).where(eq(endpoints.id, id)).returning().get() as IEndpoint;
}

function delete_(id: number): void {
  db.delete(endpoints).where(eq(endpoints.id, id)).run();
}

/** Map EndpointInput → DB column names */
function toRow(data: EndpointInput) {
  return {
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