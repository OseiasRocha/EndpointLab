import { z } from 'zod';
import {
  EndpointWithIdSchema,
  SimulatorEndpointSchema,
  TransmitResultSchema,
} from '@shared';
import type { SimulatorEndpoint, EndpointInput, TransmitResult } from '@shared';

const BASE = '/api/endpoints';

async function getErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const err = await res.json().catch(() => null) as
      | { message?: string; error?: string }
      | null;
    return err?.message ?? err?.error ?? res.statusText;
  }

  const text = await res.text().catch(() => '');
  return text || res.statusText;
}

async function handleResponse<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
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
      if (!res.ok) {
        return getErrorMessage(res).then((message) => {
          throw new Error(message);
        });
      }
    });
  },

  send(id: number): Promise<TransmitResult> {
    return fetch(`${BASE}/${id}/send`, { method: 'POST' }).then((res) =>
      handleResponse(res, TransmitResultSchema),
    );
  },

  bulkUpsert(data: EndpointInput[]): Promise<{ created: SimulatorEndpoint[]; updated: SimulatorEndpoint[] }> {
    return fetch(`${BASE}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => handleResponse(res, z.object({
      created: z.array(EndpointWithIdSchema),
      updated: z.array(EndpointWithIdSchema),
    })));
  },
};
