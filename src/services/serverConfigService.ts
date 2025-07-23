// Stub para compatibilidade - agora use environment.ts
import { getServerConfig } from '@/config/environment';

console.warn('⚠️ serverConfigService foi removido. Use environment.ts em vez disso.');

export interface ServerConfig {
  SERVER_URL: string;
  protocol: string;
  isHttps: boolean;
  apiKey: string;
}

export interface ServerStatus {
  connected: boolean;
  lastCheck: Date;
}

export const serverConfigService = {
  getConfig: getServerConfig,
  getStatus: () => ({ connected: true, lastCheck: new Date() }),
  updateConfig: () => {},
  saveConfigExplicitly: () => true,
  testConnection: () => Promise.resolve({ connected: true, lastCheck: new Date() }),
  validateConfiguration: () => Promise.resolve(true),
  exportConfig: () => JSON.stringify(getServerConfig()),
  importConfig: () => true,
  resetToDefaults: () => {},
  rollbackConfig: () => true,
  subscribe: () => () => {},
};

export default serverConfigService;