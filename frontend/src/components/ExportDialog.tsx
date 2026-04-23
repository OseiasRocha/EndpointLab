import { useState } from 'react';
import JSZip from 'jszip';
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
import type { SimulatorEndpoint } from '../types/endpoint';
import ProtocolBadge from './ProtocolBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  endpoints: SimulatorEndpoint[];
}

export default function ExportDialog({ open, onClose, endpoints }: Props) {
  // Use index as selection key — id can be undefined for unsaved copies
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(endpoints.map((_, i) => i)),
  );

  const allSelected = selected.size === endpoints.length && endpoints.length > 0;
  const noneSelected = selected.size === 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(endpoints.map((_, i) => i)));
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

  async function handleExport() {
    const zip = new JSZip();
    endpoints.forEach((ep, i) => {
      if (!selected.has(i)) return;
      const data = { ...ep };
      delete data.id;
      const safeName = ep.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      const methodPart = ep.protocol === 'HTTP' && ep.httpMethod ? `-${ep.httpMethod.toLowerCase()}` : '';
      const idPart = ep.id != null ? `-${ep.id}` : `-${i}`;
      zip.file(`${safeName}${methodPart}${idPart}.json`, JSON.stringify(data, null, 2));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'endpoints-export.zip';
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Endpoints</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={toggleAll} dense>
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
                  Select All ({endpoints.length})
                </Typography>
              }
            />
          </ListItemButton>
        </ListItem>
        <Divider />
        <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {endpoints.map((ep, i) => (
            <ListItem key={i} disablePadding>
              <ListItemButton onClick={() => toggle(i)} dense>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selected.has(i)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={ep.name}
                  secondary={`${ep.host}:${ep.port}${ep.path ?? ''}`}
                />
                <Box sx={{ ml: 1, flexShrink: 0 }}>
                  <ProtocolBadge protocol={ep.protocol} httpMethod={ep.httpMethod} />
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', pl: 2 }}>
          {selected.size} of {endpoints.length} selected
        </Typography>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={noneSelected}
          sx={{ bgcolor: '#49cc90', '&:hover': { bgcolor: '#3bb07c' }, fontWeight: 700 }}
        >
          Export ZIP
        </Button>
      </DialogActions>
    </Dialog>
  );
}
