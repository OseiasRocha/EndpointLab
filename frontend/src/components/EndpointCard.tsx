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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { SimulatorEndpoint, Protocol, HttpMethod } from '../types/endpoint';
import ProtocolBadge from './ProtocolBadge';
import JsonDisplay from './JsonDisplay';

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
}

export default function EndpointCard({ endpoint, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = endpoint.protocol === 'HTTP' && endpoint.httpMethod
    ? HTTP_BORDER[endpoint.httpMethod]
    : BORDER_COLORS[endpoint.protocol];

  const address = endpoint.protocol === 'HTTP'
    ? `${endpoint.host}:${endpoint.port}${endpoint.path ?? ''}`
    : `${endpoint.host}:${endpoint.port}`;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(v => !v)}
      disableGutters
      elevation={0}
      sx={{
        border: `1px solid #e8e8e8`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '4px !important',
        mb: 1,
        '&:before': { display: 'none' },
        bgcolor: expanded ? '#f8fff8' : '#fff',
        transition: 'background-color 0.2s',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: '#666' }} />}
        sx={{ px: 2, py: 0.5, minHeight: 52 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
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

          <Box sx={{ display: 'flex', gap: 0.5 }} onClick={e => e.stopPropagation()}>
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
      </AccordionDetails>
    </Accordion>
  );
}
