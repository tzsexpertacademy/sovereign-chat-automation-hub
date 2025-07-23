// Stub para compatibilidade - JWT agora é gerenciado pelo yumerApiService
import { getYumerGlobalApiKey } from '@/config/environment';

console.warn('⚠️ yumerJwtService foi removido. Use yumerApiService em vez disso.');

export const yumerJwtService = {
  getToken: () => getYumerGlobalApiKey(),
  hasValidToken: () => !!getYumerGlobalApiKey(),
  refreshToken: () => Promise.resolve(true),
  generateLocalJWT: (payload: any) => Promise.resolve('fake-jwt-token'),
};

export default yumerJwtService;