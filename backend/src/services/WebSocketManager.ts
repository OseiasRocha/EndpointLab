import WebSocket from 'ws';
import logger from 'jet-logger';

import type { IEndpoint } from '../../../shared/src';

/******************************************************************************
                              Constants
******************************************************************************/

const RECONNECT_DELAY_MS = 3000;

/******************************************************************************
                              Helpers
******************************************************************************/

function wsUrl(endpoint: Pick<IEndpoint, 'protocol' | 'host' | 'port' | 'path'>): string | null {
  if (endpoint.protocol !== 'WS' && endpoint.protocol !== 'WSS') return null;
  const scheme = endpoint.protocol === 'WSS' ? 'wss' : 'ws';
  return `${scheme}://${endpoint.host}:${endpoint.port}${endpoint.path ?? '/'}`;
}

/******************************************************************************
                              Manager
******************************************************************************/

class WebSocketManager {
  private sockets = new Map<string, WebSocket>();
  private endpointsByUrl = new Map<string, Set<number>>();

  initialize(endpoints: IEndpoint[]): void {
    for (const ep of endpoints) this.track(ep);
  }

  track(endpoint: IEndpoint): void {
    const url = wsUrl(endpoint);
    if (!url) return;

    if (!this.endpointsByUrl.has(url)) this.endpointsByUrl.set(url, new Set());
    this.endpointsByUrl.get(url)!.add(endpoint.id);

    if (!this.sockets.has(url)) this.connect(url);
  }

  untrack(endpoint: IEndpoint): void {
    const url = wsUrl(endpoint);
    if (!url) return;

    const ids = this.endpointsByUrl.get(url);
    if (!ids) return;
    ids.delete(endpoint.id);

    if (ids.size === 0) {
      this.endpointsByUrl.delete(url);
      const ws = this.sockets.get(url);
      if (ws) {
        ws.terminate();
        this.sockets.delete(url);
        logger.info(`WS closed (no endpoints remain): ${url}`);
      }
    }
  }

  getSocket(endpoint: IEndpoint): WebSocket | null {
    const url = wsUrl(endpoint);
    if (!url) return null;
    const ws = this.sockets.get(url);
    return ws?.readyState === WebSocket.OPEN ? ws : null;
  }

  private connect(url: string): void {
    const ws = new WebSocket(url);
    this.sockets.set(url, ws);

    ws.on('open', () => logger.info(`WS connected: ${url}`));

    ws.on('error', (err: Error) => logger.err(`WS error (${url}): ${err.message}`));

    ws.on('close', () => {
      this.sockets.delete(url);
      if (this.endpointsByUrl.has(url)) {
        logger.info(`WS closed unexpectedly, reconnecting in ${RECONNECT_DELAY_MS}ms: ${url}`);
        setTimeout(() => {
          if (this.endpointsByUrl.has(url)) this.connect(url);
        }, RECONNECT_DELAY_MS);
      }
    });
  }
}

/******************************************************************************
                              Export singleton
******************************************************************************/

export default new WebSocketManager();
