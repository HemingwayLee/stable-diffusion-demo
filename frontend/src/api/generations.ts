import { Generation, GenerationCreate } from '../types';
import { apiClient } from './client';

export const createGeneration = async (data: GenerationCreate): Promise<Generation> =>
  (await apiClient.post<Generation>('/generations/', data)).data;

export const getGeneration = async (id: string): Promise<Generation> =>
  (await apiClient.get<Generation>(`/generations/${id}`)).data;

export const listGenerations = async (limit = 50, offset = 0): Promise<Generation[]> =>
  (await apiClient.get<Generation[]>('/generations/', { params: { limit, offset } })).data;

export const deleteGeneration = async (id: string): Promise<void> => {
  await apiClient.delete(`/generations/${id}`);
};
