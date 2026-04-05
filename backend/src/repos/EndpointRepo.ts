import { eq } from 'drizzle-orm';

import db from '@src/db';
import { endpoints } from '@src/db/schema';
import { IEndpoint, EndpointInput } from '@src/schemas/endpointSchema';

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
  update,
  delete: delete_,
} as const;