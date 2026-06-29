import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MemoryIcon from '@mui/icons-material/Memory';
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getModelStatus, loadModel } from '../api/status';
import { ModelStatus as ModelStatusType } from '../types';

const shortModelName = (id: string) => id.split('/').pop() ?? id;

export default function ModelStatus() {
  const queryClient = useQueryClient();

  const { data } = useQuery<ModelStatusType>({
    queryKey: ['model-status'],
    queryFn: getModelStatus,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'ready' || s === 'error' ? false : 3000;
    },
    retry: false,
  });

  const { mutate: triggerLoad, isPending } = useMutation({
    mutationFn: loadModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['model-status'] }),
  });

  if (!data) return null;

  const { status, model_id, device, error } = data;

  if (status === 'not_started') {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={isPending ? <CircularProgress size={12} thickness={5} /> : <MemoryIcon />}
        onClick={() => triggerLoad()}
        disabled={isPending}
        sx={{ textTransform: 'none' }}
      >
        Load Model
      </Button>
    );
  }

  const icon =
    status === 'ready' ? (
      <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
    ) : status === 'error' ? (
      <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
    ) : (
      <CircularProgress size={12} thickness={5} />
    );

  const label =
    status === 'ready'
      ? `${shortModelName(model_id)} · ${device}`
      : status === 'loading'
        ? 'Loading model…'
        : 'Model error';

  return (
    <Tooltip
      title={
        status === 'error' && error ? (
          <Typography variant="caption">{error}</Typography>
        ) : status === 'loading' ? (
          <Typography variant="caption">
            Loading {shortModelName(model_id)} — this can take a few minutes on first run.
          </Typography>
        ) : (
          <Typography variant="caption">{model_id}</Typography>
        )
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'default' }}>
        <MemoryIcon sx={{ fontSize: 14, opacity: 0.5 }} />
        {icon}
        <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
