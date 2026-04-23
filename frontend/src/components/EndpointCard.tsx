import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { SimulatorEndpoint, TransmitResult, Protocol, HttpMethod } from '../types/endpoint';
import { endpointsApi } from '../api/endpoints';
import { diffJson, type DiffResult } from '../utils/jsonDiff';
import ProtocolBadge from './ProtocolBadge';
import JsonDisplay from './JsonDisplay';
import JsonDiffDisplay from './JsonDiffDisplay';

const BORDER_COLORS: Record<Protocol, string> = {
  HTTP: '#49cc90',
  TCP: '#9b59b6',
  UDP: '#e67e22',
};

const HTTP_BORDER: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  DELETE: '#f93e3e',
  PATCH: '#50e3c2',
};

interface Props {
  endpoint: SimulatorEndpoint;
  onEdit: (endpoint: SimulatorEndpoint) => void;
  onDelete: (id: number) => void;
  onCopy: (endpoint: SimulatorEndpoint) => void;
}

export default function EndpointCard({ endpoint, onEdit, onDelete, onCopy }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [transmitResult, setTransmitResult] = useState<TransmitResult | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);

  const borderColor = endpoint.protocol === 'HTTP' && endpoint.httpMethod
    ? HTTP_BORDER[endpoint.httpMethod]
    : BORDER_COLORS[endpoint.protocol];

  const address = endpoint.protocol === 'HTTP'
    ? `${endpoint.host}:${endpoint.port}${endpoint.path ?? ''}`
    : `${endpoint.host}:${endpoint.port}`;

  async function handleSend() {
    setSending(true);
    setTransmitResult(null);
    setDiffResult(null);
    try {
      const result = await endpointsApi.send(endpoint.id!);
      setTransmitResult(result);
      if (endpoint.hasResponse && endpoint.responseBody && result.responseBody) {
        setDiffResult(diffJson(endpoint.responseBody, result.responseBody));
      }
      setExpanded(true);
    } catch (err) {
      setTransmitResult({ success: false, error: String(err), latencyMs: 0 });
      setExpanded(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <Box sx={{ position: 'relative', mb: 1 }}>
      {/* Action buttons sit outside AccordionSummary to avoid <button> inside <button> */}
      <Box
        sx={{ position: 'absolute', top: 0, height: 52, right: 44, display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 1, pr: 1 }}
        onClick={e => e.stopPropagation()}
      >
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={() => onCopy(endpoint)}>
            <ContentCopyIcon fontSize="small" sx={{ color: '#666' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(endpoint)}>
            <EditIcon fontSize="small" sx={{ color: '#666' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(endpoint.id!)}>
            <DeleteIcon fontSize="small" sx={{ color: '#e74c3c' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Accordion
        expanded={expanded}
        onChange={() => setExpanded(v => !v)}
        disableGutters
        elevation={0}
        sx={{
          border: `1px solid #e8e8e8`,
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: '4px !important',
          '&:before': { display: 'none' },
          bgcolor: expanded ? '#f8fff8' : '#fff',
          transition: 'background-color 0.2s',
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: '#666' }} />}
          sx={{ px: 2, py: 0.5, minHeight: 52, pr: 19 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
            <ProtocolBadge protocol={endpoint.protocol} httpMethod={endpoint.httpMethod} />

            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '0.875rem',
                color: '#333',
                fontWeight: 500,
                flex: 1,
              }}
            >
              {address}
            </Typography>

            <Typography
              sx={{ fontSize: '0.85rem', color: '#666', flex: 2, display: { xs: 'none', sm: 'block' } }}
              noWrap
            >
              {endpoint.name}
            </Typography>

            <Tooltip title={endpoint.hasResponse ? 'Sends response' : 'No response'}>
              {endpoint.hasResponse
                ? <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#49cc90' }} />
                : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: '#aaa' }} />
              }
            </Tooltip>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 3, pb: 2, pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Protocol</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{endpoint.protocol}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Host</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{endpoint.host}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Port</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{endpoint.port}</Typography>
            </Box>
            {endpoint.protocol === 'HTTP' && endpoint.path && (
              <Box>
                <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Path</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{endpoint.path}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Response</Typography>
              <Chip
                label={endpoint.hasResponse ? 'Yes' : 'No'}
                size="small"
                sx={{
                  bgcolor: endpoint.hasResponse ? '#e8f8f0' : '#f5f5f5',
                  color: endpoint.hasResponse ? '#27ae60' : '#888',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 20,
                  mt: 0.25,
                }}
              />
            </Box>
          </Box>

          {endpoint.description && (
            <Typography variant="body2" sx={{ color: '#555', mb: 2, fontStyle: 'italic' }}>
              {endpoint.description}
            </Typography>
          )}

          <JsonDisplay label="Request Body" value={endpoint.requestBody} />
          {endpoint.hasResponse && <JsonDisplay label="Response Body" value={endpoint.responseBody} />}

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={sending}
              startIcon={sending ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SendIcon />}
              sx={{
                bgcolor: '#4990e2',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.875rem',
                textTransform: 'none',
                px: 3,
                py: 1,
                borderRadius: 1,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#3a7bc8', boxShadow: 'none' },
                '&:disabled': { bgcolor: '#b0c9ee', color: '#fff' },
              }}
            >
              {sending ? 'Sending…' : 'Execute'}
            </Button>
          </Box>

          {transmitResult && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {transmitResult.success
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: '#49cc90' }} />
                  : <ErrorIcon sx={{ fontSize: 18, color: '#e74c3c' }} />
                }
                <Typography variant="caption" sx={{ fontWeight: 700, color: transmitResult.success ? '#27ae60' : '#e74c3c', textTransform: 'uppercase' }}>
                  {transmitResult.success ? 'Success' : 'Failed'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#888', ml: 'auto' }}>
                  {transmitResult.latencyMs} ms
                </Typography>
              </Box>
              {transmitResult.error && (
                <Typography variant="body2" sx={{ color: '#e74c3c', fontFamily: 'monospace', fontSize: '0.8rem', mb: 1 }}>
                  {transmitResult.error}
                </Typography>
              )}
              {transmitResult.responseBody && (
                diffResult
                  ? <JsonDiffDisplay label="Received Response" received={transmitResult.responseBody} diff={diffResult} />
                  : <JsonDisplay label="Received Response" value={transmitResult.responseBody} />
              )}
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}