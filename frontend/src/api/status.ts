import { ModelStatus } from '../types';
import { apiClient } from './client';

export const getModelStatus = async (): Promise<ModelStatus> =>
  (await apiClient.get<ModelStatus>('/status/')).data;

export const loadModel = async (): Promise<void> => {
  await apiClient.post('/status/load');
};
