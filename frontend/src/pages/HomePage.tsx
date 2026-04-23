import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import type { SimulatorEndpoint, Protocol } from '../types/endpoint';
import type { EndpointInput } from '@shared';
import { endpointsApi } from '../api/endpoints';
import { useColorMode } from '../App';
import EndpointCard from '../components/EndpointCard';
import AddEditDialog from '../components/AddEditDialog';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';

const PROTOCOL_FILTERS: Array<Protocol | 'ALL'> = ['ALL', 'HTTP', 'TCP', 'UDP'];
const PROTOCOLS: Protocol[] = ['HTTP', 'TCP', 'UDP'];
const UNGROUPED = '__ungrouped__';

// App header color — intentionally always dark regardless of mode (brand identity)
const HEADER_BG = '#173647';

interface CardSharedProps {
  onEdit: (ep: SimulatorEndpoint) => void;
  onDelete: (id: number) => void;
  onCopy: (ep: SimulatorEndpoint) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  draggingId: number | null;
}

function ProtocolSection({ proto, endpoints, ...shared }: CardSharedProps & { proto: Protocol; endpoints: SimulatorEndpoint[] }) {
  if (!endpoints.length) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {proto}
        </Typography>
        <Divider sx={{ flex: 1 }} />
      </Box>
      {endpoints.map(ep => (
        <EndpointCard
          key={ep.id}
          endpoint={ep}
          onEdit={shared.onEdit}
          onDelete={shared.onDelete}
          onCopy={shared.onCopy}
          onDragStart={shared.onDragStart}
          onDragEnd={shared.onDragEnd}
          isDragging={shared.draggingId === ep.id}
        />
      ))}
    </Box>
  );
}

export default function HomePage() {
  const theme = useTheme();
  const { toggle, mode } = useColorMode();
  const [endpoints, setEndpoints] = useState<SimulatorEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SimulatorEndpoint | undefined>();
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<Protocol | 'ALL'>('ALL');
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  // Precompute alpha values using the resolved theme
  const groupHoverBg    = alpha(theme.palette.primary.main, 0.08);
  const groupActiveBg   = alpha(theme.palette.primary.main, 0.15);

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

  function toggleGroup(name: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleDrop(targetGroup: string) {
    if (draggingId === null) return;
    setDragOverGroup(null);
    const ep = endpoints.find(e => e.id === draggingId);
    if (!ep) return;
    const newGroup = targetGroup === UNGROUPED ? undefined : targetGroup;
    if ((ep.group ?? undefined) === newGroup) return;
    try {
      const updated = await endpointsApi.update(draggingId, { ...ep, group: newGroup });
      setEndpoints(eps => eps.map(e => e.id === updated.id ? updated : e));
    } catch (err) {
      setToast({ msg: String(err), severity: 'error' });
    } finally {
      setDraggingId(null);
    }
  }

  function dropTargetProps(groupKey: string) {
    const isOver = dragOverGroup === groupKey;
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverGroup(groupKey); },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverGroup(null);
      },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); handleDrop(groupKey); },
      isOver,
    };
  }

  function openAdd() { setEditing(undefined); setDialogOpen(true); }
  function openEdit(ep: SimulatorEndpoint) { setEditing(ep); setDialogOpen(true); }
  function openCopy(ep: SimulatorEndpoint) {
    const { id: _id, ...rest } = ep;
    setEditing({ ...rest, name: `Copy of ${ep.name}` } as SimulatorEndpoint);
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

  async function handleBulkImport(data: EndpointInput[]) {
    const { created, updated } = await endpointsApi.bulkUpsert(data);
    setEndpoints(eps => {
      const updatedIds = new Set(updated.map(u => u.id));
      return [...eps.filter(e => !updatedIds.has(e.id)), ...updated, ...created];
    });
    const parts: string[] = [];
    if (created.length) parts.push(`${created.length} added`);
    if (updated.length) parts.push(`${updated.length} updated`);
    setToast({ msg: `Imported: ${parts.join(', ')}`, severity: 'success' });
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
      || (ep.description ?? '').toLowerCase().includes(q)
      || (ep.group ?? '').toLowerCase().includes(q);
    return matchesProtocol && matchesSearch;
  });

  const groupNames = [...new Set(
    endpoints.map(e => e.group).filter((g): g is string => !!g)
  )].sort((a, b) => a.localeCompare(b));

  const cardShared: CardSharedProps = {
    onEdit: openEdit,
    onDelete: handleDelete,
    onCopy: openCopy,
    onDragStart: (id) => setDraggingId(id),
    onDragEnd: () => setDraggingId(null),
    draggingId,
  };

  // Shared sx for group header boxes
  function groupHeaderSx(isOver: boolean) {
    return {
      display: 'flex', alignItems: 'center', gap: 1, mb: 1,
      px: 1.5, py: 1, borderRadius: 1, cursor: 'pointer',
      border: '1px solid',
      borderColor: isOver ? 'primary.main' : 'divider',
      bgcolor: isOver ? groupActiveBg : 'action.hover',
      transition: 'background-color 0.15s, border-color 0.15s',
      '&:hover': { bgcolor: isOver ? groupActiveBg : groupHoverBg },
    };
  }

  return (
    <Box>
      {/* Header — always dark navy (brand identity) */}
      <Box sx={{ bgcolor: HEADER_BG, color: '#fff', px: { xs: 2, md: 4 }, py: 2.5 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              EndpointLab
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
              Manage simulated endpoints with HTTP, TCP and UDP protocols.
            </Typography>
          </Box>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton
              onClick={toggle}
              sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Toolbar */}
      <Box sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider', px: { xs: 2, md: 4 }, py: 1.5 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => setExportOpen(true)}
            disabled={endpoints.length === 0}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Export
          </Button>
          <TextField
            placeholder="Search endpoints…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200, bgcolor: 'background.paper', borderRadius: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'background.paper', borderRadius: 1 }}>
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
            color="primary"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
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
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography variant="h6">No endpoints found</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {endpoints.length === 0 ? 'Click "Add Endpoint" to create your first one.' : 'Try adjusting the filters.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filtered.length} endpoint{filtered.length !== 1 ? 's' : ''}
                {filtered.length !== endpoints.length ? ` (filtered from ${endpoints.length})` : ''}
              </Typography>
            </Box>

            {/* Named groups */}
            {groupNames.map(groupName => {
              const groupEps = filtered.filter(e => e.group === groupName);
              if (!groupEps.length) return null;
              const isCollapsed = collapsedGroups.has(groupName);
              const { onDragOver, onDragLeave, onDrop, isOver } = dropTargetProps(groupName);
              return (
                <Box key={groupName} sx={{ mb: 3 }} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                  <Box sx={groupHeaderSx(isOver)} onClick={() => toggleGroup(groupName)}>
                    <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.primary' }} tabIndex={-1}>
                      {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                    {isCollapsed
                      ? <FolderIcon fontSize="small" sx={{ color: 'text.primary' }} />
                      : <FolderOpenIcon fontSize="small" sx={{ color: 'text.primary' }} />
                    }
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', flex: 1 }}>
                      {groupName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {groupEps.length} endpoint{groupEps.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  <Collapse in={!isCollapsed}>
                    <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'divider', ml: 1 }}>
                      {PROTOCOLS.map(proto => (
                        <ProtocolSection
                          key={proto}
                          proto={proto}
                          endpoints={groupEps.filter(e => e.protocol === proto)}
                          {...cardShared}
                        />
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}

            {/* Ungrouped */}
            {(() => {
              const ungrouped = filtered.filter(e => !e.group);
              if (!ungrouped.length) return null;
              const isCollapsed = collapsedGroups.has(UNGROUPED);
              const showHeader = groupNames.length > 0;
              const { onDragOver, onDragLeave, onDrop, isOver } = dropTargetProps(UNGROUPED);
              return (
                <Box sx={{ mb: 3 }} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                  {showHeader && (
                    <Box sx={groupHeaderSx(isOver)} onClick={() => toggleGroup(UNGROUPED)}>
                      <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.secondary' }} tabIndex={-1}>
                        {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                      <FolderIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', flex: 1 }}>
                        Ungrouped
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {ungrouped.length} endpoint{ungrouped.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                  <Collapse in={!isCollapsed}>
                    <Box sx={showHeader ? { pl: 2, borderLeft: 2, borderColor: 'divider', ml: 1 } : {}}>
                      {PROTOCOLS.map(proto => (
                        <ProtocolSection
                          key={proto}
                          proto={proto}
                          endpoints={ungrouped.filter(e => e.protocol === proto)}
                          {...cardShared}
                        />
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })()}
          </>
        )}
      </Box>

      <AddEditDialog
        key={`${editing?.id ?? 'new'}-${dialogOpen ? 'open' : 'closed'}`}
        open={dialogOpen}
        initial={editing}
        groups={groupNames}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} endpoints={endpoints} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} existingEndpoints={endpoints} onImport={handleBulkImport} />

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
