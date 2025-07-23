// Stub para compatibilidade - agora use yumerApiService
import { yumerApiService } from './yumerApiService';

console.warn('⚠️ codechatV2ApiService foi removido. Use yumerApiService em vez disso.');

export const codechatV2ApiService = {
  getBusinessProfile: () => Promise.resolve({}),
  updateBusinessProfile: () => Promise.resolve({}),
  getCatalog: () => Promise.resolve([]),
  sendCatalogMessage: () => Promise.resolve({ success: true }),
  sendProductMessage: () => Promise.resolve({ success: true }),
};

export default codechatV2ApiService;