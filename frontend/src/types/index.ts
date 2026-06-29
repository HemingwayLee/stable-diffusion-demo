export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type GenerationType = 'txt2img' | 'img2img';

export type AspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '9:21'
  | '21:9';

export interface Generation {
  id: string;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  aspect_ratio: AspectRatio;
  cfg_scale: number;
  steps: number;
  seed: number | null;
  actual_seed: number | null;
  generation_type: GenerationType;
  strength: number | null;
  status: GenerationStatus;
  image_url: string | null;
  input_image_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface GenerationCreate {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio: AspectRatio;
  cfg_scale: number;
  steps: number;
  seed?: number;
}

export interface Img2ImgCreate {
  image: File;
  prompt: string;
  negative_prompt?: string;
  strength: number;
  cfg_scale: number;
  steps: number;
  seed?: number;
}

export interface ModelLoadProgress {
  loaded_components: number;
  total_components: number;
}

export interface ModelStatus {
  model_id: string;
  status: 'not_started' | 'loading' | 'ready' | 'error';
  device: string;
  error: string | null;
  is_turbo: boolean;
  progress: ModelLoadProgress | null;
}
