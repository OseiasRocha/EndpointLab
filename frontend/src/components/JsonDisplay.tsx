import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Props {
  label: string;
  value?: string;
}

function tryFormat(raw?: string): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function JsonDisplay({ label, value }: Props) {
  if (!value) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          borderRadius: 1,
          fontSize: '0.8rem',
          overflowX: 'auto',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          lineHeight: 1.5,
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {tryFormat(value)}
      </Box>
    </Box>
  );
}
