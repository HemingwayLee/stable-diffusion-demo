import { ModelStatus } from '../types';
import { apiClient } from './client';

export const getModelStatus = async (): Promise<ModelStatus> =>
  (await apiClient.get<ModelStatus>('/status/')).data;
