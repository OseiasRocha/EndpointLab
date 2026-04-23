import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { annotateLines, formatValue, type DiffResult } from '../utils/jsonDiff';

interface Props {
  label: string;
  received: string;
  diff: DiffResult;
}

export default function JsonDiffDisplay({ label, received, diff }: Props) {
  const header = diff.ok ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
      <CheckCircleIcon sx={{ fontSize: 15, color: '#49cc90' }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#27ae60', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} — matches expected
      </Typography>
    </Box>
  ) : (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
      <ErrorIcon sx={{ fontSize: 15, color: '#e74c3c' }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#e74c3c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} — {'parseError' in diff ? diff.parseError : 'mismatch detected'}
      </Typography>
    </Box>
  );

  // Parse error: just show raw with error banner
  if (!diff.ok && 'parseError' in diff) {
    return (
      <Box sx={{ mt: 1.5 }}>
        {header}
        <Box component="pre" sx={codeBoxSx}>
          {received}
        </Box>
      </Box>
    );
  }

  if (diff.ok && diff.format === 'text') {
    return (
      <Box sx={{ mt: 1.5 }}>
        {header}
        <Box component="pre" sx={codeBoxSx}>
          {received}
        </Box>
      </Box>
    );
  }

  const parsedReceived = JSON.parse(received) as unknown;

  // Match or mismatch with line annotations
  const lines = diff.ok
    ? annotateLines(parsedReceived, [])
    : annotateLines(parsedReceived, diff.mismatches);

  return (
    <Box sx={{ mt: 1.5 }}>
      {header}

      {/* Line-annotated JSON */}
      <Box component="pre" sx={{ ...codeBoxSx, p: 0, overflow: 'hidden' }}>
        {lines.map((line, i) => (
          <Box
            key={i}
            component="span"
            sx={{
              display: 'block',
              px: 1.5,
              py: '1px',
              bgcolor: line.error ? 'rgba(231,76,60,0.18)' : 'transparent',
              borderLeft: line.error ? '3px solid #e74c3c' : '3px solid transparent',
              color: line.error ? '#ff9b9b' : '#d4d4d4',
            }}
          >
            {line.text || ' '}
          </Box>
        ))}
      </Box>

      {/* Mismatch table */}
      {!diff.ok && 'mismatches' in diff && diff.mismatches.length > 0 && (
        <Box sx={{ mt: 1, border: '1px solid #3a1a1a', borderRadius: 1, overflow: 'hidden', fontSize: '0.75rem', fontFamily: 'monospace' }}>
          {/* Table header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', bgcolor: '#2a1010', px: 1.5, py: 0.5 }}>
            {['Path', 'Expected', 'Received'].map(h => (
              <Typography key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#e74c3c', textTransform: 'uppercase' }}>
                {h}
              </Typography>
            ))}
          </Box>
          {/* Rows */}
          {diff.mismatches.map((m, i) => (
            <Box
              key={i}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                px: 1.5,
                py: 0.5,
                bgcolor: i % 2 === 0 ? '#1e1e1e' : '#222',
                borderTop: '1px solid #2a2a2a',
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: '#e0a0a0', fontFamily: 'monospace' }}>{m.path}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#49cc90', fontFamily: 'monospace' }}>{formatValue(m.expected)}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#e74c3c', fontFamily: 'monospace' }}>{formatValue(m.received)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

const codeBoxSx = {
  mt: 0.5,
  bgcolor: '#1e1e1e',
  color: '#d4d4d4',
  borderRadius: 1,
  fontSize: '0.8rem',
  overflowX: 'auto',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  lineHeight: 1.6,
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
} as const;
