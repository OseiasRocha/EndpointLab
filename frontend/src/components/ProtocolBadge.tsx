import Chip from '@mui/material/Chip';
import type { Protocol, HttpMethod } from '../types/endpoint';

const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  DELETE: '#f93e3e',
  PATCH: '#50e3c2',
};

const PROTOCOL_COLORS: Record<Protocol, string> = {
  HTTP: '#49cc90',
  HTTPS: '#1f9d8b',
  TCP: '#9b59b6',
  UDP: '#e67e22',
  WS: '#2980b9',
  WSS: '#1a5276',
};

interface Props {
  protocol: Protocol;
  httpMethod?: HttpMethod;
}

export default function ProtocolBadge({ protocol, httpMethod }: Props) {
  const label = (protocol === 'HTTP' || protocol === 'HTTPS') && httpMethod ? httpMethod : protocol;
  const bg = (protocol === 'HTTP' || protocol === 'HTTPS') && httpMethod
    ? HTTP_METHOD_COLORS[httpMethod]
    : PROTOCOL_COLORS[protocol];

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: bg,
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.7rem',
        letterSpacing: '0.05em',
        borderRadius: '3px',
        minWidth: 64,
        height: 24,
      }}
    />
  );
}
