import { WebSocket, WebSocketServer } from 'ws';
import http, { IncomingMessage } from 'http'
import logger from 'jet-logger';

import { WebSocketTypeSchema, type IEndpoint } from '../../../shared/src';
import { Duplex } from 'stream';
import { Socket } from 'net';

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
  private socketClients = new Map<string, WebSocket>();
  private endpointsByUrl = new Map<string, Set<number>>();
  private httpServers = new Map<number, http.Server>();
  private socketServersPerPort = new Map<number, Set<string>>();
  private socketServersPerUrl = new Map<string, WebSocketServer>();

  initialize(endpoints: IEndpoint[]): void {
    for (const ep of endpoints) this.track(ep);
  }

  track(endpoint: IEndpoint): void {
    if (endpoint.websocketType === "Client") {
      const url = wsUrl(endpoint);
      if (!url) return;

      if (!this.endpointsByUrl.has(url)) this.endpointsByUrl.set(url, new Set());
      this.endpointsByUrl.get(url)!.add(endpoint.id);

      if (!this.socketClients.has(url)) this.connect(url);

    } else if (endpoint.websocketType === "Server") {
      const path = endpoint.path;
      const port = endpoint.port;
      if (!path || !port) return;

      const serverUrl = port + path;

      if (!this.endpointsByUrl.has(serverUrl)) this.endpointsByUrl.set(serverUrl, new Set());
      this.endpointsByUrl.get(serverUrl)!.add(endpoint.id);

      if (!this.socketServersPerUrl.get(serverUrl)) this.serve(serverUrl);

      if (!this.httpServers.has(port)) {
        const newServer = http.createServer();
        newServer.listen(port);
        newServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          const reqPath = (socket as Socket).localPort + request.url!;
          const wsServer = this.socketServersPerUrl.get(reqPath)!;
          if (wsServer) {
            wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
              wsServer.emit('connection', ws, request);
              logger.info(`Client connected on ${serverUrl}`)
            });
          } else {
            socket.destroy();
          }
          this.socketServersPerPort.set(port, new Set());
          this.socketServersPerPort.get(port)!.add(reqPath);
        })
        this.httpServers.set(port, newServer);
      }
      logger.info(`Created new WebSocket on ${port}${path}`);
    }
  }

  untrack(endpoint: IEndpoint): Promise<void> {
    let url = wsUrl(endpoint);
    if (endpoint.websocketType === 'Server') {
      url = endpoint.port + endpoint.path!;
    }
    if (!url) return;

    const ids = this.endpointsByUrl.get(url);
    if (!ids) return;
    ids.delete(endpoint.id);

    if (ids.size === 0) {
      this.endpointsByUrl.delete(url);
      const ws = this.socketClients.get(url);
      const wsServer = this.socketServersPerUrl.get(url);
      if (ws) {
        ws.terminate();
        this.socketClients.delete(url);
        logger.info(`WS closed (no endpoints remain): ${url}`);
      }
      if (wsServer) {
        wsServer.close();
        this.socketServersPerUrl.delete(url);
        const sockets = this.socketServersPerPort.get(endpoint.port);
        sockets?.delete(url);
        if(sockets?.size === 0) {
          const server = this.httpServers.get(endpoint.port);
          server?.close();
          server?.closeAllConnections();
          this.httpServers.delete(endpoint.port);
        }
        logger.info(`Deleted webSocket ${url}`);
      }
    }
  }

  getClientSocket(endpoint: IEndpoint): WebSocket | null {
    const url = wsUrl(endpoint);
    if (!url) return null;
    const ws = this.socketClients.get(url);
    return ws?.readyState === WebSocket.OPEN ? ws : null;
  }

  getServerSocket(path: string): WebSocketServer | null {
    return this.socketServersPerUrl.get(path) ?? null;
  }

  private connect(url: string): void {
    const ws = new WebSocket(url);
    this.socketClients.set(url, ws);

    ws.on('open', () => logger.info(`WS connected: ${url}`));

    ws.on('error', (err: Error) => logger.err(`WS error (${url}): ${err.message}`));

    ws.on('close', () => {
      this.socketClients.delete(url);
      if (this.endpointsByUrl.has(url)) {
        logger.info(`WS closed unexpectedly, reconnecting in ${RECONNECT_DELAY_MS}ms: ${url}`);
        setTimeout(() => {
          if (this.endpointsByUrl.has(url)) this.connect(url);
        }, RECONNECT_DELAY_MS);
      }
    });
  }

  private serve(path: string): void {
    const wsServer = new WebSocketServer({ noServer: true });
    this.socketServersPerUrl.set(path, wsServer);

    wsServer.on('connection', (ws: WebSocket) => {
      console.log(`Client connected to ${path}`);

      ws.on('close', () => logger.info(`Client disconnected from ${path}`));
      ws.on('error', (err: Error) => logger.err(`Error in ${path}. Error:${err}`));
    })
  }
}

/******************************************************************************
                              Export singleton
******************************************************************************/

export default new WebSocketManager();
