import { Alert, Box, Collapse } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { createGeneration, getGeneration } from '../api/generations';
import { getModelStatus } from '../api/status';
import GenerationForm from '../components/GenerationForm';
import GenerationResult from '../components/GenerationResult';
import { GenerationCreate, GenerationStatus, ModelStatus } from '../types';

const POLLING_STATUSES: GenerationStatus[] = ['pending', 'generating'];

export default function HomePage() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: modelStatus } = useQuery<ModelStatus>({
    queryKey: ['model-status'],
    queryFn: getModelStatus,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'ready' || s === 'error' ? false : 3000;
    },
    retry: false,
  });

  const { mutate: generate, isPending: isSubmitting } = useMutation({
    mutationFn: createGeneration,
    onSuccess: (gen) => setCurrentId(gen.id),
  });

  const { data: currentGeneration } = useQuery({
    queryKey: ['generation', currentId],
    queryFn: () => getGeneration(currentId!),
    enabled: !!currentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && POLLING_STATUSES.includes(status)) return 1500;
      if (status === 'completed' || status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['generations'] });
      }
      return false;
    },
  });

  const handleGenerate = useCallback(
    (data: GenerationCreate) => generate(data),
    [generate],
  );

  const isGenerating =
    isSubmitting ||
    currentGeneration?.status === 'pending' ||
    currentGeneration?.status === 'generating';

  const showLoadingBanner =
    modelStatus && (modelStatus.status === 'loading' || modelStatus.status === 'not_started');

  const showErrorBanner = modelStatus?.status === 'error';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Collapse in={showLoadingBanner}>
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          The model is downloading and loading — this takes a few minutes on first run. You can
          monitor progress in the backend container logs.
        </Alert>
      </Collapse>
      <Collapse in={showErrorBanner}>
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          Model failed to load: {modelStatus?.error}
        </Alert>
      </Collapse>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', height: 0, minHeight: 0 }}>
        <Box
          sx={{
            width: 360,
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.07)',
            overflowY: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GenerationForm onGenerate={handleGenerate} isGenerating={isGenerating} />
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <GenerationResult
            generation={currentGeneration ?? null}
            isSubmitting={isSubmitting}
          />
        </Box>
      </Box>
    </Box>
  );
}
