import type { SimulatorEndpoint } from '../types/endpoint';

const BASE = '/api/endpoints';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const endpointsApi = {
  getAll(): Promise<SimulatorEndpoint[]> {
    return fetch(BASE).then(handleResponse<SimulatorEndpoint[]>);
  },

  create(data: Omit<SimulatorEndpoint, 'id'>): Promise<SimulatorEndpoint> {
    return fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<SimulatorEndpoint>);
  },

  update(id: number, data: Omit<SimulatorEndpoint, 'id'>): Promise<SimulatorEndpoint> {
    return fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<SimulatorEndpoint>);
  },

  remove(id: number): Promise<void> {
    return fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(handleResponse<void>);
  },
};
