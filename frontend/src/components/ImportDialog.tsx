import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { EndpointSchema } from '@shared';
import type { SimulatorEndpoint, EndpointInput } from '@shared';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
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
  isDuplicate?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  existingEndpoints: SimulatorEndpoint[];
  onImport: (endpoints: EndpointInput[]) => Promise<void>;
}

export default function ImportDialog({ open, onClose, existingEndpoints, onImport }: Props) {
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (importing) return;
    setEntries([]);
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
            const isDuplicate = existingEndpoints.some(
              e => e.name === result.data.name && e.host === result.data.host && e.port === result.data.port
            );
            parsed.push({ filename, data: result.data, isDuplicate });
          }
        } catch {
          parsed.push({ filename, error: 'Invalid JSON' });
        }
      }

      if (parsed.length === 0) {
        setParseError('No JSON files found in the ZIP.');
        return;
      }

      setEntries(parsed);
      setStep('preview');
    } catch {
      setParseError('Could not read the ZIP file. Make sure it was exported from EndpointLab.');
    }
  }

  async function handleImport() {
    const toImport = entries.filter(e => e.data && !e.isDuplicate).map(e => e.data!);
    setImporting(true);
    try {
      await onImport(toImport);
      handleClose();
    } finally {
      setImporting(false);
    }
  }

  const validCount = entries.filter(e => e.data && !e.isDuplicate).length;
  const duplicateCount = entries.filter(e => e.isDuplicate).length;
  const errorCount = entries.filter(e => !!e.error).length;

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
              border: '2px dashed #ccc',
              borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { borderColor: '#49cc90', bgcolor: 'rgba(73,204,144,0.04)' },
            }}
            onClick={() => fileRef.current?.click()}
          >
            <UploadFileIcon sx={{ fontSize: 48, color: '#aaa' }} />
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
          <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={`${validCount} to import`} color="success" size="small" />
            {duplicateCount > 0 && (
              <Chip label={`${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`} color="warning" size="small" />
            )}
            {errorCount > 0 && (
              <Chip label={`${errorCount} invalid`} color="error" size="small" />
            )}
          </Box>
          <Divider />
          <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {entries.map((entry, i) => (
              <ListItem
                key={i}
                divider
                sx={{ gap: 1, opacity: entry.isDuplicate || entry.error ? 0.65 : 1 }}
                secondaryAction={
                  entry.error ? (
                    <Chip label="Invalid" color="error" size="small" />
                  ) : entry.isDuplicate ? (
                    <Chip label="Duplicate" color="warning" size="small" />
                  ) : entry.data ? (
                    <ProtocolBadge protocol={entry.data.protocol} httpMethod={entry.data.httpMethod} />
                  ) : null
                }
              >
                <ListItemText
                  primary={entry.data?.name ?? entry.filename}
                  secondary={
                    entry.error
                      ? entry.error
                      : entry.isDuplicate
                      ? `Already exists: ${entry.data!.host}:${entry.data!.port}`
                      : `${entry.data!.host}:${entry.data!.port}${entry.data!.path ?? ''}`
                  }
                  secondaryTypographyProps={{
                    color: entry.error ? 'error' : entry.isDuplicate ? 'warning.main' : 'text.secondary',
                    sx: { fontSize: '0.75rem' },
                  }}
                  sx={{ pr: 10 }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      )}

      <DialogActions>
        {step === 'preview' && (
          <Button onClick={() => { setStep('select'); setParseError(null); if (fileRef.current) fileRef.current.value = ''; }} sx={{ mr: 'auto' }} disabled={importing}>
            Back
          </Button>
        )}
        <Button onClick={handleClose} disabled={importing}>Cancel</Button>
        {step === 'preview' && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={validCount === 0 || importing}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: '#49cc90', '&:hover': { bgcolor: '#3bb07c' }, fontWeight: 700 }}
          >
            {importing ? 'Importing…' : `Import ${validCount}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
