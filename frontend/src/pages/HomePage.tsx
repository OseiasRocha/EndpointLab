import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import type { SimulatorEndpoint, Protocol } from '../types/endpoint';
import { endpointsApi } from '../api/endpoints';
import EndpointCard from '../components/EndpointCard';
import AddEditDialog from '../components/AddEditDialog';

const PROTOCOL_FILTERS: Array<Protocol | 'ALL'> = ['ALL', 'HTTP', 'TCP', 'UDP'];

export default function HomePage() {
  const [endpoints, setEndpoints] = useState<SimulatorEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SimulatorEndpoint | undefined>();
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<Protocol | 'ALL'>('ALL');

  async function load() {
    setLoading(true);
    try {
      const data = await endpointsApi.getAll();
      setEndpoints(data);
    } catch {
      setToast({ msg: 'Failed to load endpoints', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(ep: SimulatorEndpoint) {
    setEditing(ep);
    setDialogOpen(true);
  }

  async function handleSave(data: Omit<SimulatorEndpoint, 'id'>) {
    try {
      if (editing?.id) {
        const updated = await endpointsApi.update(editing.id, data);
        setEndpoints(eps => eps.map(e => e.id === updated.id ? updated : e));
        setToast({ msg: 'Endpoint updated', severity: 'success' });
      } else {
        const created = await endpointsApi.create(data);
        setEndpoints(eps => [...eps, created]);
        setToast({ msg: 'Endpoint added', severity: 'success' });
      }
      setDialogOpen(false);
    } catch (err) {
      setToast({ msg: String(err), severity: 'error' });
    }
  }

  async function handleDelete(id: number) {
    try {
      await endpointsApi.remove(id);
      setEndpoints(eps => eps.filter(e => e.id !== id));
      setToast({ msg: 'Endpoint deleted', severity: 'success' });
    } catch (err) {
      setToast({ msg: String(err), severity: 'error' });
    }
  }

  const filtered = endpoints.filter(ep => {
    const matchesProtocol = protocolFilter === 'ALL' || ep.protocol === protocolFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q
      || ep.name.toLowerCase().includes(q)
      || ep.host.toLowerCase().includes(q)
      || String(ep.port).includes(q)
      || (ep.path ?? '').toLowerCase().includes(q)
      || (ep.description ?? '').toLowerCase().includes(q);
    return matchesProtocol && matchesSearch;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ bgcolor: '#173647', color: '#fff', px: { xs: 2, md: 4 }, py: 3 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Endpoint Simulator
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
            Manage simulated endpoints with HTTP, TCP and UDP protocols. Define request and response messages per endpoint.
          </Typography>
          <Box sx={{ mt: 2, px: 2, py: 1.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1, display: 'inline-block' }}>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>Base URL</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#98e5c1' }}>
              http://localhost:3000
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Toolbar */}
      <Box sx={{ bgcolor: '#f4f7f9', borderBottom: '1px solid #e0e0e0', px: { xs: 2, md: 4 }, py: 1.5 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search endpoints…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200, bgcolor: '#fff', borderRadius: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#999' }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 120, bgcolor: '#fff', borderRadius: 1 }}>
            <InputLabel>Protocol</InputLabel>
            <Select
              value={protocolFilter}
              label="Protocol"
              onChange={e => setProtocolFilter(e.target.value as Protocol | 'ALL')}
            >
              {PROTOCOL_FILTERS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={{ bgcolor: '#49cc90', '&:hover': { bgcolor: '#3bb07c' }, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Add Endpoint
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: '#aaa' }}>
            <Typography variant="h6">No endpoints found</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {endpoints.length === 0 ? 'Click "Add Endpoint" to create your first one.' : 'Try adjusting the filters.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#888' }}>
                {filtered.length} endpoint{filtered.length !== 1 ? 's' : ''}
                {filtered.length !== endpoints.length ? ` (filtered from ${endpoints.length})` : ''}
              </Typography>
            </Box>

            {/* Group by protocol */}
            {PROTOCOL_FILTERS.filter(p => p !== 'ALL').map(proto => {
              const group = filtered.filter(e => e.protocol === proto);
              if (!group.length) return null;
              return (
                <Box key={proto} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {proto}
                    </Typography>
                    <Divider sx={{ flex: 1 }} />
                  </Box>
                  {group.map(ep => (
                    <EndpointCard
                      key={ep.id}
                      endpoint={ep}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </Box>
              );
            })}
          </>
        )}
      </Box>

      <AddEditDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ boxShadow: 3 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
