/* eslint-disable no-process-env */
import http, { IncomingMessage } from 'http';
import https from 'https';
import { Duplex } from 'stream';

import logger from 'jet-logger';
import { WebSocket, WebSocketServer } from 'ws';

import type { IEndpoint } from '../../../shared/src';
import {
  loadTlsCredentials,
  TlsConfigurationError,
  type TlsCredentialValues,
} from './TlsCredentials';

/******************************************************************************
                              Constants
******************************************************************************/

const RECONNECT_DELAY_MS = 3000;

type ServerProtocol = 'WS' | 'WSS';
type UpgradeServer = http.Server | https.Server;

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

export class WebSocketManager {
  private socketClients = new Map<string, WebSocket>();
  private endpointsByUrl = new Map<string, Set<number>>();
  private httpServers = new Map<number, UpgradeServer>();
  private serverProtocolsPerPort = new Map<number, ServerProtocol>();
  private socketServersPerPort = new Map<number, Set<string>>();
  private socketServersPerUrl = new Map<string, WebSocketServer>();

  constructor(private readonly tlsCredentials: TlsCredentialValues = {
    privateKey: process.env.TLS_PRIVATE_KEY,
    certificate: process.env.TLS_CERTIFICATE,
    certificateChain: process.env.TLS_CERTIFICATE_CHAIN,
  }) {}

  async initialize(endpoints: IEndpoint[]): Promise<void> {
    for (const ep of endpoints) await this.track(ep);
  }

  async track(endpoint: IEndpoint): Promise<void> {
    if (endpoint.websocketType === 'Client') {
      const url = wsUrl(endpoint);
      if (!url) return;

      if (!this.endpointsByUrl.has(url)) this.endpointsByUrl.set(url, new Set());
      this.endpointsByUrl.get(url)!.add(endpoint.id);

      if (!this.socketClients.has(url)) this.connect(url);

    } else if (endpoint.websocketType === 'Server') {
      const path = endpoint.path;
      const port = endpoint.port;
      if (!path || !port) return;

      const protocol = endpoint.protocol as ServerProtocol;
      const activeProtocol = this.serverProtocolsPerPort.get(port);
      if (activeProtocol && activeProtocol !== protocol) {
        throw new Error(
          `Port ${port} already hosts ${activeProtocol} endpoints and cannot also host ${protocol}`,
        );
      }

      const serverUrl = port + path;
      const newServer = !this.httpServers.has(port)
        ? this.createUpgradeServer(protocol)
        : null;

      if (!this.endpointsByUrl.has(serverUrl)) this.endpointsByUrl.set(serverUrl, new Set());
      this.endpointsByUrl.get(serverUrl)!.add(endpoint.id);

      if (!this.socketServersPerUrl.get(serverUrl)) this.serve(serverUrl);

      if (!this.socketServersPerPort.has(port)) this.socketServersPerPort.set(port, new Set());
      this.socketServersPerPort.get(port)!.add(serverUrl);

      if (newServer) {
        newServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          const reqPath = port + (request.url ?? '/');
          const wsServer = this.socketServersPerUrl.get(reqPath);
          if (wsServer) {
            wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
              wsServer.emit('connection', ws, request);
              logger.info(`Client connected on ${reqPath}`);
            });
          } else {
            socket.destroy();
          }
        });
        this.httpServers.set(port, newServer);
        this.serverProtocolsPerPort.set(port, protocol);
        try {
          await this.listen(newServer, port);
        } catch (err) {
          this.httpServers.delete(port);
          this.serverProtocolsPerPort.delete(port);
          const serverUrls = this.socketServersPerPort.get(port);
          serverUrls?.delete(serverUrl);
          if (serverUrls?.size === 0) this.socketServersPerPort.delete(port);
          this.socketServersPerUrl.delete(serverUrl);
          this.endpointsByUrl.delete(serverUrl);
          throw err;
        }
      }
      logger.info(`Created new WebSocket on ${port}${path}`);
    }
  }

  async untrack(endpoint: IEndpoint): Promise<void> {
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
        this.socketServersPerUrl.delete(url);
        const sockets = this.socketServersPerPort.get(endpoint.port);
        sockets?.delete(url);
        wsServer.clients.forEach(client => client.terminate());
        await this.closeWebSocketServer(wsServer);

        if (sockets?.size === 0) {
          this.socketServersPerPort.delete(endpoint.port);
          const server = this.httpServers.get(endpoint.port);
          this.httpServers.delete(endpoint.port);
          this.serverProtocolsPerPort.delete(endpoint.port);
          if (server) await this.closeHttpServer(server);
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
      if (this.socketClients.get(url) === ws) this.socketClients.delete(url);
      if (this.endpointsByUrl.has(url)) {
        logger.info(`WS closed unexpectedly, reconnecting in ${RECONNECT_DELAY_MS}ms: ${url}`);
        setTimeout(() => {
          if (this.endpointsByUrl.has(url) && !this.socketClients.has(url)) this.connect(url);
        }, RECONNECT_DELAY_MS);
      }
    });
  }

  private serve(path: string): void {
    const wsServer = new WebSocketServer({ noServer: true });
    this.socketServersPerUrl.set(path, wsServer);

    wsServer.on('connection', (ws: WebSocket) => {
      logger.info(`Client connected to ${path}`);

      ws.on('close', () => logger.info(`Client disconnected from ${path}`));
      ws.on('error', (err: Error) => logger.err(`Error in ${path}. Error:${err}`));
    });
  }

  private createUpgradeServer(protocol: ServerProtocol): UpgradeServer {
    if (protocol === 'WS') return http.createServer();

    try {
      return https.createServer(loadTlsCredentials(this.tlsCredentials));
    } catch (err) {
      if (err instanceof TlsConfigurationError) throw err;
      throw new TlsConfigurationError(
        'Cannot create WSS endpoint: the configured TLS credentials are invalid',
      );
    }
  }

  private listen(server: UpgradeServer, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      server.once('error', onError);
      server.listen(port, () => {
        server.off('error', onError);
        server.on('error', (err: Error) => logger.err(err.message));
        resolve();
      });
    });
  }

  private closeWebSocketServer(server: WebSocketServer): Promise<void> {
    return new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }

  private closeHttpServer(server: UpgradeServer): Promise<void> {
    return new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close(err => err ? reject(err) : resolve());
    });
  }
}

/******************************************************************************
                              Export singleton
******************************************************************************/

export default new WebSocketManager();
