import { Generation, GenerationCreate, Img2ImgCreate } from '../types';
import { apiClient } from './client';

export const createGeneration = async (data: GenerationCreate): Promise<Generation> =>
  (await apiClient.post<Generation>('/generations/', data)).data;

export const createImg2ImgGeneration = async (data: Img2ImgCreate): Promise<Generation> => {
  const form = new FormData();
  form.append('image', data.image);
  form.append('prompt', data.prompt);
  if (data.negative_prompt) form.append('negative_prompt', data.negative_prompt);
  form.append('strength', String(data.strength));
  form.append('cfg_scale', String(data.cfg_scale));
  form.append('steps', String(data.steps));
  if (data.seed != null) form.append('seed', String(data.seed));

  return (
    await apiClient.post<Generation>('/generations/img2img/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data;
};

export const getGeneration = async (id: string): Promise<Generation> =>
  (await apiClient.get<Generation>(`/generations/${id}`)).data;

export const listGenerations = async (limit = 50, offset = 0): Promise<Generation[]> =>
  (await apiClient.get<Generation[]>('/generations/', { params: { limit, offset } })).data;

export const deleteGeneration = async (id: string): Promise<void> => {
  await apiClient.delete(`/generations/${id}`);
};
