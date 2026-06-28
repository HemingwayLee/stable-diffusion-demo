import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { getModelStatus } from '../api/status';
import { AspectRatio, GenerationCreate, ModelStatus } from '../types';

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 — Square' },
  { value: '16:9', label: '16:9 — Landscape' },
  { value: '9:16', label: '9:16 — Portrait' },
  { value: '4:5', label: '4:5 — Instagram' },
  { value: '3:2', label: '3:2 — Photo' },
  { value: '2:3', label: '2:3 — Portrait Photo' },
  { value: '21:9', label: '21:9 — Ultrawide' },
  { value: '9:21', label: '9:21 — Tall' },
];

interface Props {
  onGenerate: (data: GenerationCreate) => void;
  isGenerating: boolean;
}

export default function GenerationForm({ onGenerate, isGenerating }: Props) {
  const { data: modelStatus } = useQuery<ModelStatus>({
    queryKey: ['model-status'],
    queryFn: getModelStatus,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'ready' || s === 'error' ? false : 3000;
    },
    retry: false,
  });

  const isTurbo = modelStatus?.is_turbo ?? false;
  const modelReady = modelStatus?.status === 'ready';

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [cfgScale, setCfgScale] = useState(7.0);
  const [steps, setSteps] = useState(28);
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Snap to turbo-appropriate defaults when the model info arrives
  useEffect(() => {
    if (isTurbo) {
      setSteps(4);
      setCfgScale(1.0);
    } else {
      setSteps(28);
      setCfgScale(7.0);
    }
  }, [isTurbo]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !modelReady) return;
    onGenerate({
      prompt: prompt.trim(),
      negative_prompt: (!isTurbo && negativePrompt.trim()) ? negativePrompt.trim() : undefined,
      aspect_ratio: aspectRatio,
      cfg_scale: cfgScale,
      steps,
      seed: seed ? parseInt(seed, 10) : undefined,
    });
  };

  const disabled = isGenerating || !modelReady;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}
    >
      <Typography variant="h6" fontWeight={700}>
        Generate
      </Typography>

      <TextField
        label="Prompt"
        multiline
        rows={5}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A photorealistic portrait of a cyberpunk samurai in neon-lit Tokyo, cinematic lighting..."
        required
        fullWidth
        disabled={disabled}
      />

      {!isTurbo && (
        <TextField
          label="Negative Prompt"
          multiline
          rows={2}
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="blurry, low quality, deformed..."
          fullWidth
          disabled={disabled}
        />
      )}

      <FormControl fullWidth disabled={disabled}>
        <InputLabel>Aspect Ratio</InputLabel>
        <Select
          value={aspectRatio}
          label="Aspect Ratio"
          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
        >
          {ASPECT_RATIOS.map((ar) => (
            <MenuItem key={ar.value} value={ar.value}>
              {ar.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => setShowAdvanced(!showAdvanced)}
          color="inherit"
          sx={{ opacity: 0.65, mb: 0.5 }}
          disabled={disabled}
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </Button>
        <Collapse in={showAdvanced}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Steps: <strong>{steps}</strong>
                {isTurbo && (
                  <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                    (turbo: 4–8 recommended)
                  </Typography>
                )}
              </Typography>
              <Slider
                value={steps}
                onChange={(_, v) => setSteps(v as number)}
                min={1}
                max={isTurbo ? 10 : 50}
                step={1}
                marks={
                  isTurbo
                    ? [{ value: 4, label: '4' }, { value: 8, label: '8' }]
                    : [{ value: 1, label: '1' }, { value: 28, label: '28' }, { value: 50, label: '50' }]
                }
                disabled={disabled}
              />
            </Box>
            <Box>
              <Typography variant="body2" gutterBottom>
                CFG Scale: <strong>{cfgScale}</strong>
              </Typography>
              <Slider
                value={cfgScale}
                onChange={(_, v) => setCfgScale(v as number)}
                min={0}
                max={20}
                step={0.5}
                marks={[{ value: 0, label: '0' }, { value: 7, label: '7' }, { value: 20, label: '20' }]}
                disabled={disabled}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label="Seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
                inputProps={{ min: 0, max: 4294967294 }}
                fullWidth
                size="small"
                disabled={disabled}
              />
              <Tooltip title="Random seed">
                <span>
                  <IconButton
                    onClick={() => setSeed(String(Math.floor(Math.random() * 4294967294)))}
                    size="small"
                    disabled={disabled}
                  >
                    <CasinoIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Box sx={{ flex: 1 }} />
      <Divider />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={disabled || !prompt.trim()}
        startIcon={<AutoAwesomeIcon />}
        fullWidth
        sx={{ py: 1.5, mt: 0.5 }}
      >
        {isGenerating
          ? 'Generating…'
          : !modelReady
            ? modelStatus?.status === 'loading'
              ? 'Model loading…'
              : 'Waiting for model…'
            : 'Generate'}
      </Button>
    </Box>
  );
}
