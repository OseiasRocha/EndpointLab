export interface EndpointIdentityLike {
  externalId?: string;
  name: string;
  protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP' | 'WS' | 'WSS';
  host: string;
  port: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
}

export function getEndpointFallbackKey(endpoint: EndpointIdentityLike): string {
  const base = [
    endpoint.name.trim(),
    endpoint.protocol,
    endpoint.host.trim(),
    String(endpoint.port),
  ];

  if (endpoint.protocol === 'HTTP' || endpoint.protocol === 'HTTPS') {
    base.push(endpoint.httpMethod ?? '', endpoint.path ?? '');
  } else if (endpoint.protocol === 'WS' || endpoint.protocol === 'WSS') {
    base.push(endpoint.path ?? '');
  }

  return base.join('|');
}

export function getEndpointImportKey(endpoint: EndpointIdentityLike): string {
  return endpoint.externalId
    ? `external:${endpoint.externalId}`
    : `fallback:${getEndpointFallbackKey(endpoint)}`;
}
