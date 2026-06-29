import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { Generation } from '../types';

interface Props {
  generation: Generation | null;
  isSubmitting: boolean;
}

export default function GenerationResult({ generation, isSubmitting }: Props) {
  const isLoading =
    isSubmitting ||
    generation?.status === 'pending' ||
    generation?.status === 'generating';

  if (!generation && !isSubmitting) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.3,
          gap: 2,
          userSelect: 'none',
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 96 }} />
        <Typography variant="h6">Your image will appear here</Typography>
        <Typography variant="body2">Enter a prompt and click Generate to start</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      {generation && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label={generation.status}
            color={
              generation.status === 'completed'
                ? 'success'
                : generation.status === 'failed'
                  ? 'error'
                  : 'primary'
            }
            size="small"
          />
          {generation.generation_type === 'img2img' ? (
            <Chip label={`strength ${generation.strength?.toFixed(2)}`} size="small" variant="outlined" />
          ) : (
            <Chip label={generation.aspect_ratio} size="small" variant="outlined" />
          )}
          <Chip label={`${generation.steps} steps`} size="small" variant="outlined" />
          <Chip label={`cfg ${generation.cfg_scale}`} size="small" variant="outlined" />
          {generation.actual_seed != null && (
            <Chip label={`seed ${generation.actual_seed}`} size="small" variant="outlined" />
          )}
          {generation.duration_ms != null && (
            <Chip
              label={`${(generation.duration_ms / 1000).toFixed(1)}s`}
              size="small"
              variant="outlined"
            />
          )}
          {generation.status === 'completed' && generation.image_url && (
            <Tooltip title="Download">
              <IconButton
                component="a"
                href={generation.image_url}
                download
                size="small"
                sx={{ ml: 'auto' }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
        }}
      >
        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={72} thickness={2} />
            <Typography color="text.secondary">
              {isSubmitting
                ? 'Submitting…'
                : generation?.status === 'pending'
                  ? 'Queued…'
                  : 'Running inference…'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              GPU: seconds · CPU: several minutes
            </Typography>
          </Box>
        )}

        {!isLoading && generation?.status === 'failed' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ErrorOutlineIcon sx={{ fontSize: 72, color: 'error.main' }} />
            <Typography variant="h6" color="error">
              Generation failed
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 480, textAlign: 'center' }}
            >
              {generation.error_message ?? 'An unknown error occurred.'}
            </Typography>
          </Box>
        )}

        {!isLoading && generation?.status === 'completed' && generation.image_url && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
            {generation.input_image_url && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">INPUT</Typography>
                <Box
                  component="img"
                  src={generation.input_image_url}
                  alt="Input"
                  sx={{
                    maxHeight: '60vh',
                    maxWidth: '45%',
                    objectFit: 'contain',
                    borderRadius: 2,
                    opacity: 0.85,
                  }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              {generation.input_image_url && (
                <Typography variant="caption" color="text.secondary">OUTPUT</Typography>
              )}
              <Box
                component="img"
                src={generation.image_url}
                alt={generation.prompt}
                sx={{
                  maxWidth: generation.input_image_url ? '45%' : '100%',
                  maxHeight: '68vh',
                  objectFit: 'contain',
                  borderRadius: 2,
                  boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {generation && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            PROMPT
          </Typography>
          <Typography variant="body2">{generation.prompt}</Typography>
          {generation.negative_prompt && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 1.5 }}
                gutterBottom
              >
                NEGATIVE PROMPT
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {generation.negative_prompt}
              </Typography>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
