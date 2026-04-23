import { z } from 'zod';
import {
  EndpointWithIdSchema,
  SimulatorEndpointSchema,
  TransmitResultSchema,
} from '@shared';
import type { SimulatorEndpoint, EndpointInput, TransmitResult } from '@shared';

const BASE = '/api/endpoints';

async function handleResponse<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

export const endpointsApi = {
  getAll(): Promise<SimulatorEndpoint[]> {
    return fetch(BASE).then((res) =>
      handleResponse(res, z.array(EndpointWithIdSchema)),
    );
  },

  create(data: Omit<SimulatorEndpoint, 'id'>): Promise<SimulatorEndpoint> {
    return fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => handleResponse(res, SimulatorEndpointSchema));
  },

  update(id: number, data: Omit<SimulatorEndpoint, 'id'>): Promise<SimulatorEndpoint> {
    return fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => handleResponse(res, SimulatorEndpointSchema));
  },

  remove(id: number): Promise<void> {
    return fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok) throw new Error(res.statusText);
    });
  },

  send(id: number): Promise<TransmitResult> {
    return fetch(`${BASE}/${id}/send`, { method: 'POST' }).then((res) =>
      handleResponse(res, TransmitResultSchema),
    );
  },

  bulkCreate(data: EndpointInput[]): Promise<SimulatorEndpoint[]> {
    return fetch(`${BASE}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => handleResponse(res, z.array(EndpointWithIdSchema)));
  },
};
