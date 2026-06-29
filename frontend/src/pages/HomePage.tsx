import { Alert, Box, Collapse, LinearProgress, Tab, Tabs, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { createGeneration, getGeneration } from '../api/generations';
import { getModelStatus } from '../api/status';
import GenerationForm from '../components/GenerationForm';
import GenerationResult from '../components/GenerationResult';
import Img2ImgForm from '../components/Img2ImgForm';
import { GenerationCreate, GenerationStatus, ModelStatus } from '../types';

const POLLING_STATUSES: GenerationStatus[] = ['pending', 'generating'];

export default function HomePage() {
  const [tab, setTab] = useState<'txt2img' | 'img2img'>('txt2img');
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

  const handleImg2ImgSuccess = useCallback((id: string) => setCurrentId(id), []);

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
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            bgcolor: 'background.paper',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {(() => {
            const p = modelStatus?.progress;
            const hasComponents = !!p && p.total_components > 0;
            const pct = hasComponents
              ? Math.round((p!.loaded_components / p!.total_components) * 100)
              : 0;
            return (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    {hasComponents
                      ? `Loading model components… ${p!.loaded_components} / ${p!.total_components}`
                      : 'Downloading model files…'}
                  </Typography>
                  {hasComponents && (
                    <Typography variant="caption" color="text.secondary">
                      {pct}%
                    </Typography>
                  )}
                </Box>
                <LinearProgress
                  variant={hasComponents ? 'determinate' : 'indeterminate'}
                  value={hasComponents ? pct : undefined}
                  sx={{ borderRadius: 1 }}
                />
              </>
            );
          })()}
        </Box>
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
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setCurrentId(null); }}
            variant="fullWidth"
            sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}
          >
            <Tab label="Text to Image" value="txt2img" />
            <Tab label="Image to Image" value="img2img" />
          </Tabs>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {tab === 'txt2img' ? (
              <GenerationForm onGenerate={handleGenerate} isGenerating={isGenerating} />
            ) : (
              <Img2ImgForm onSuccess={handleImg2ImgSuccess} isGenerating={isGenerating} />
            )}
          </Box>
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
