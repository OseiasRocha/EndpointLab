import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import type { SimulatorEndpoint, Protocol, HttpMethod } from '../types/endpoint';

const PROTOCOLS: Protocol[] = ['HTTP', 'TCP', 'UDP'];
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const EMPTY: Omit<SimulatorEndpoint, 'id'> = {
  externalId: undefined,
  name: '',
  description: '',
  protocol: 'HTTP',
  host: 'localhost',
  port: 8080,
  httpMethod: 'GET',
  path: '/',
  requestBody: '',
  hasResponse: false,
  responseBody: '',
  group: undefined,
};

interface Props {
  open: boolean;
  initial?: SimulatorEndpoint;
  groups: string[];
  onClose: () => void;
  onSave: (data: Omit<SimulatorEndpoint, 'id'>) => void;
}

function isValidJson(s: string) {
  if (!s.trim()) return true;
  try { JSON.parse(s); return true; } catch { return false; }
}

export default function AddEditDialog({ open, initial, groups, onClose, onSave }: Props) {
  const [form, setForm] = useState<Omit<SimulatorEndpoint, 'id'>>(
    initial ? { ...EMPTY, ...initial } : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.host.trim()) e.host = 'Host is required';
    if (!form.port || form.port < 1 || form.port > 65535) e.port = 'Port must be 1–65535';
    if (form.protocol === 'HTTP' && !form.path?.trim()) e.path = 'Path is required for HTTP';
    if (form.protocol === 'HTTP' && form.requestBody && !isValidJson(form.requestBody)) e.requestBody = 'Invalid JSON';
    if (form.protocol === 'HTTP' && form.hasResponse && form.responseBody && !isValidJson(form.responseBody)) e.responseBody = 'Invalid JSON';
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload = { ...form };
    if (payload.protocol !== 'HTTP') {
      delete payload.httpMethod;
      delete payload.path;
    }
    if (!payload.hasResponse) delete payload.responseBody;
    onSave(payload);
  }

  const isEditing = !!initial?.id;
  const usesJsonBodies = form.protocol === 'HTTP';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ bgcolor: '#173647', color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
        {isEditing ? 'Edit Endpoint' : 'Add New Endpoint'}
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Basic Info */}
          <TextField
            label="Name *"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            size="small"
            fullWidth
          />
          <TextField
            label="Description"
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />

          <Autocomplete
            freeSolo
            options={groups}
            value={form.group ?? ''}
            onChange={(_, value) => set('group', value ?? undefined)}
            onInputChange={(_, value) => set('group', value || undefined)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Group"
                size="small"
                fullWidth
                placeholder="Type to create or select a group"
              />
            )}
          />

          <Divider>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
              Connection
            </Typography>
          </Divider>

          {/* Protocol + Method */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Protocol *</InputLabel>
              <Select
                value={form.protocol}
                label="Protocol *"
                onChange={e => set('protocol', e.target.value as Protocol)}
              >
                {PROTOCOLS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>

            {form.protocol === 'HTTP' && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Method *</InputLabel>
                <Select
                  value={form.httpMethod ?? 'GET'}
                  label="Method *"
                  onChange={e => set('httpMethod', e.target.value as HttpMethod)}
                >
                  {HTTP_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Host *"
              value={form.host}
              onChange={e => set('host', e.target.value)}
              error={!!errors.host}
              helperText={errors.host}
              size="small"
              sx={{ flex: 1, minWidth: 160 }}
            />

            <TextField
              label="Port *"
              type="number"
              value={form.port}
              onChange={e => set('port', Number(e.target.value))}
              error={!!errors.port}
              helperText={errors.port}
              size="small"
              sx={{ width: 110 }}
              inputProps={{ min: 1, max: 65535 }}
            />
          </Box>

          {form.protocol === 'HTTP' && (
            <TextField
              label="Path *"
              value={form.path ?? ''}
              onChange={e => set('path', e.target.value)}
              error={!!errors.path}
              helperText={errors.path}
              size="small"
              fullWidth
              placeholder="/api/resource"
            />
          )}

          <Divider>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
              Messages
            </Typography>
          </Divider>

          {/* Request body */}
          <TextField
            label={usesJsonBodies ? 'Request Body (JSON)' : 'Request Body'}
            value={form.requestBody ?? ''}
            onChange={e => set('requestBody', e.target.value)}
            error={!!errors.requestBody}
            helperText={errors.requestBody || (usesJsonBodies ? 'Optional JSON payload to send' : 'Optional plain-text payload to send')}
            size="small"
            fullWidth
            multiline
            rows={5}
            inputProps={{ style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' } }}
          />

          {/* Response toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={form.hasResponse}
                onChange={e => set('hasResponse', e.target.checked)}
                color="success"
              />
            }
            label="Wait for a response"
          />

          {/* Response body */}
          {form.hasResponse && (
            <TextField
              label={usesJsonBodies ? 'Expected Response Body (JSON)' : 'Expected Response Body'}
              value={form.responseBody ?? ''}
              onChange={e => set('responseBody', e.target.value)}
              error={!!errors.responseBody}
              helperText={errors.responseBody || (usesJsonBodies
                ? 'Optional expected JSON payload used for comparison'
                : 'Optional expected plain-text payload used for comparison')}
              size="small"
              fullWidth
              multiline
              rows={5}
              inputProps={{ style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' } }}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ bgcolor: '#49cc90', '&:hover': { bgcolor: '#3bb07c' }, color: '#fff', fontWeight: 700 }}>
          {isEditing ? 'Save Changes' : 'Add Endpoint'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
