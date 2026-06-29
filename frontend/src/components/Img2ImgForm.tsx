import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { DragEvent, FormEvent, useCallback, useRef, useState } from 'react';
import { createImg2ImgGeneration } from '../api/generations';
import { getModelStatus } from '../api/status';
import { ModelStatus } from '../types';

interface Props {
  onSuccess: (id: string) => void;
  isGenerating: boolean;
}

export default function Img2ImgForm({ onSuccess, isGenerating }: Props) {
  const { data: modelStatus } = useQuery<ModelStatus>({
    queryKey: ['model-status'],
    queryFn: getModelStatus,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'ready' || s === 'error' ? false : 3000;
    },
    retry: false,
  });

  const modelReady = modelStatus?.status === 'ready';

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [strength, setStrength] = useState(0.75);
  const [cfgScale, setCfgScale] = useState(7.0);
  const [steps, setSteps] = useState(28);
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: createImg2ImgGeneration,
    onSuccess: (gen) => onSuccess(gen.id),
  });

  const applyFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) applyFile(file);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!imageFile || !prompt.trim() || !modelReady) return;
    mutate({
      image: imageFile,
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      strength,
      cfg_scale: cfgScale,
      steps,
      seed: seed ? parseInt(seed, 10) : undefined,
    });
  };

  const disabled = isGenerating || isPending || !modelReady;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}
    >
      <Typography variant="h6" fontWeight={700}>
        Image to Image
      </Typography>

      {/* Upload zone */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !imageFile && fileInputRef.current?.click()}
        sx={{
          position: 'relative',
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          minHeight: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: imageFile ? 'default' : 'pointer',
          transition: 'border-color 0.2s',
          bgcolor: isDragging ? 'rgba(144,202,249,0.05)' : 'transparent',
          '&:hover': imageFile ? {} : { borderColor: 'primary.light' },
        }}
      >
        {imagePreview ? (
          <>
            <Box
              component="img"
              src={imagePreview}
              alt="Input"
              sx={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 220 }}
            />
            <Tooltip title="Remove image">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); clearImage(); }}
                sx={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Box sx={{ textAlign: 'center', p: 2, pointerEvents: 'none' }}>
            <UploadFileIcon sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drop an image here or click to browse
            </Typography>
          </Box>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) applyFile(f); }}
        />
      </Box>

      {/* Strength slider — shown prominently, not in advanced */}
      <Box>
        <Typography variant="body2" gutterBottom>
          Strength: <strong>{strength.toFixed(2)}</strong>
          <Typography component="span" variant="caption" color="text.secondary" ml={1}>
            (how much to change the image)
          </Typography>
        </Typography>
        <Slider
          value={strength}
          onChange={(_, v) => setStrength(v as number)}
          min={0.1}
          max={1.0}
          step={0.05}
          marks={[
            { value: 0.1, label: '0.1' },
            { value: 0.5, label: '0.5' },
            { value: 1.0, label: '1.0' },
          ]}
          disabled={disabled}
        />
      </Box>

      <TextField
        label="Prompt"
        multiline
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A photorealistic portrait of a cyberpunk samurai..."
        required
        fullWidth
        disabled={disabled}
      />

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
              </Typography>
              <Slider
                value={steps}
                onChange={(_, v) => setSteps(v as number)}
                min={1}
                max={50}
                step={1}
                marks={[{ value: 1, label: '1' }, { value: 28, label: '28' }, { value: 50, label: '50' }]}
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
        disabled={disabled || !prompt.trim() || !imageFile}
        startIcon={<AutoAwesomeIcon />}
        fullWidth
        sx={{ py: 1.5, mt: 0.5 }}
      >
        {isGenerating || isPending
          ? 'Generating…'
          : !modelReady
            ? modelStatus?.status === 'loading'
              ? 'Model loading…'
              : 'Waiting for model…'
            : !imageFile
              ? 'Upload an image first'
              : 'Generate'}
      </Button>
    </Box>
  );
}
