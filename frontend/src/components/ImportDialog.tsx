import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { EndpointSchema, getEndpointFallbackKey } from '@shared';
import type { SimulatorEndpoint, EndpointInput } from '@shared';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ProtocolBadge from './ProtocolBadge';

interface ParsedEntry {
  filename: string;
  data?: EndpointInput;
  error?: string;
  willUpdate?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  existingEndpoints: SimulatorEndpoint[];
  onImport: (endpoints: EndpointInput[]) => Promise<void>;
}

export default function ImportDialog({ open, onClose, existingEndpoints, onImport }: Props) {
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (importing) return;
    setEntries([]);
    setSelected(new Set());
    setStep('select');
    setParseError(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const parsed: ParsedEntry[] = [];

      for (const [filename, zipFile] of Object.entries(zip.files)) {
        if (zipFile.dir || !filename.replace(/^.*\//, '').endsWith('.json')) continue;
        try {
          const text = await zipFile.async('text');
          const json: unknown = JSON.parse(text);
          const result = EndpointSchema.safeParse(json);
          if (!result.success) {
            const msg = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
            parsed.push({ filename, error: msg });
          } else {
            const willUpdate = result.data.externalId
              ? existingEndpoints.some((e) => e.externalId === result.data.externalId)
              : existingEndpoints.some((e) => getEndpointFallbackKey(e) === getEndpointFallbackKey(result.data));
            parsed.push({ filename, data: result.data, willUpdate });
          }
        } catch {
          parsed.push({ filename, error: 'Invalid JSON' });
        }
      }

      if (parsed.length === 0) {
        setParseError('No JSON files found in the ZIP.');
        return;
      }

      const validIndices = new Set(
        parsed.map((e, i) => (e.data && !e.error ? i : -1)).filter(i => i >= 0)
      );
      setEntries(parsed);
      setSelected(validIndices);
      setStep('preview');
    } catch {
      setParseError('Could not read the ZIP file. Make sure it was exported from EndpointLab.');
    }
  }

  const validIndices = entries.map((e, i) => (e.data && !e.error ? i : -1)).filter(i => i >= 0);
  const allSelected = validIndices.length > 0 && validIndices.every(i => selected.has(i));
  const noneSelected = validIndices.every(i => !selected.has(i));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(validIndices));
    }
  }

  function toggle(index: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport() {
    const toImport = entries
      .map((e, i) => (selected.has(i) && e.data && !e.error ? e.data : null))
      .filter((d): d is EndpointInput => d !== null);

    setImporting(true);
    try {
      await onImport(toImport);
      handleClose();
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = validIndices.filter(i => selected.has(i)).length;
  const errorCount = entries.filter(e => !!e.error).length;

  const newCount = entries.filter((e, i) => selected.has(i) && e.data && !e.willUpdate).length;
  const updateCount = entries.filter((e, i) => selected.has(i) && e.willUpdate).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Endpoints</DialogTitle>

      {step === 'select' ? (
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 5,
              gap: 2,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { borderColor: '#49cc90', bgcolor: 'rgba(73,204,144,0.04)' },
            }}
            onClick={() => fileRef.current?.click()}
          >
            <UploadFileIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="body1" fontWeight={600}>
              Click to select a ZIP file
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Select a .zip file previously exported from EndpointLab
            </Typography>
            {parseError && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                {parseError}
              </Typography>
            )}
          </Box>
          <input
            type="file"
            accept=".zip"
            ref={fileRef}
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </DialogContent>
      ) : (
        <DialogContent dividers sx={{ p: 0 }}>
          {/* Select All row */}
          <ListItem disablePadding>
            <ListItemButton onClick={toggleAll} dense disabled={validIndices.length === 0}>
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={allSelected}
                  indeterminate={!noneSelected && !allSelected}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={700}>
                    Select All ({validIndices.length} valid)
                  </Typography>
                }
              />
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {newCount > 0 && <Chip label={`${newCount} new`} color="success" size="small" />}
                {updateCount > 0 && <Chip label={`${updateCount} update`} color="info" size="small" />}
                {errorCount > 0 && <Chip label={`${errorCount} invalid`} color="error" size="small" />}
              </Box>
            </ListItemButton>
          </ListItem>
          <Divider />
          <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {entries.map((entry, i) => {
              const isValid = !!entry.data && !entry.error;
              return (
                <ListItem key={i} disablePadding divider sx={{ opacity: entry.error ? 0.55 : 1 }}>
                  <ListItemButton
                    onClick={() => isValid && toggle(i)}
                    dense
                    disabled={!isValid}
                    sx={{ cursor: isValid ? 'pointer' : 'default' }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selected.has(i)}
                        tabIndex={-1}
                        disableRipple
                        disabled={!isValid}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.data?.name ?? entry.filename}
                      secondary={
                        entry.error
                          ? entry.error
                          : entry.willUpdate
                          ? `Will update: ${entry.data!.host}:${entry.data!.port}`
                          : `${entry.data!.host}:${entry.data!.port}${entry.data!.path ?? ''}`
                      }
                      secondaryTypographyProps={{
                        color: entry.error ? 'error' : entry.willUpdate ? 'info.main' : 'text.secondary',
                        sx: { fontSize: '0.75rem' },
                      }}
                      sx={{ pr: 2 }}
                    />
                    <Box sx={{ ml: 1, flexShrink: 0 }}>
                      {entry.error ? (
                        <Chip label="Invalid" color="error" size="small" />
                      ) : entry.willUpdate ? (
                        <Chip label="Update" color="info" size="small" />
                      ) : entry.data ? (
                        <ProtocolBadge protocol={entry.data.protocol} httpMethod={entry.data.httpMethod} />
                      ) : null}
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
      )}

      <DialogActions>
        {step === 'preview' && (
          <Button
            onClick={() => { setStep('select'); setParseError(null); if (fileRef.current) fileRef.current.value = ''; }}
            sx={{ mr: 'auto' }}
            disabled={importing}
          >
            Back
          </Button>
        )}
        <Button onClick={handleClose} disabled={importing}>Cancel</Button>
        {step === 'preview' && (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {selectedCount} of {validIndices.length} selected
            </Typography>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ bgcolor: '#49cc90', '&:hover': { bgcolor: '#3bb07c' }, fontWeight: 700 }}
            >
              {importing ? 'Importing…' : `Import ${selectedCount}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
