import type { AppConfig } from '../types/domain';
import { apiRequest } from './api';

interface ConfigResponse {
  config: AppConfig;
}

export const fetchAppConfig = async (): Promise<AppConfig> => {
  const response = await apiRequest<ConfigResponse>('/config');
  return response.config;
};

export const updateAppConfig = async (config: AppConfig): Promise<AppConfig> => {
  const response = await apiRequest<ConfigResponse>('/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });

  return response.config;
};
