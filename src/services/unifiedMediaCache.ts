/**
 * Cache unificado para otimizar performance de mídia
 * Centraliza gestão de cache para DirectMediaDownloadService
 */

interface CacheEntry {
  url: string;
  timestamp: number;
  strategy: string;
  mimeType?: string;
}

interface CacheStats {
  totalEntries: number;
  memoryUsage: string;
  expiredEntries: number;
  hitRate: number;
}

class UnifiedMediaCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 30 * 60 * 1000; // 30 minutos
  private hits = 0;
  private requests = 0;

  /**
   * Gerar chave única para cache
   */
  private generateKey(instanceId: string, messageId: string, mediaKey?: string): string {
    return `${instanceId}:${messageId}:${mediaKey || 'no-key'}`;
  }

  /**
   * Verificar se item está no cache e válido
   */
  get(instanceId: string, messageId: string, mediaKey?: string): string | null {
    this.requests++;
    const key = this.generateKey(instanceId, messageId, mediaKey);
    const entry = this.cache.get(key);

    if (!entry) {
      console.log('🔍 UnifiedCache: MISS -', key);
      return null;
    }

    // Verificar se expirou
    if (Date.now() - entry.timestamp > this.TTL) {
      console.log('⏰ UnifiedCache: EXPIRED -', key);
      this.cache.delete(key);
      URL.revokeObjectURL(entry.url);
      return null;
    }

    this.hits++;
    console.log('✅ UnifiedCache: HIT -', key, `(${entry.strategy})`);
    return entry.url;
  }

  /**
   * Adicionar ao cache
   */
  set(instanceId: string, messageId: string, url: string, strategy: string, mediaKey?: string, mimeType?: string): void {
    const key = this.generateKey(instanceId, messageId, mediaKey);
    
    // Se já existe, remover o antigo
    const existing = this.cache.get(key);
    if (existing) {
      URL.revokeObjectURL(existing.url);
    }

    this.cache.set(key, {
      url,
      timestamp: Date.now(),
      strategy,
      mimeType
    });

    console.log('💾 UnifiedCache: STORED -', key, `(${strategy})`);
  }

  /**
   * Limpar itens expirados
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        URL.revokeObjectURL(entry.url);
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 UnifiedCache: Limpou ${cleaned} itens expirados`);
    }

    return cleaned;
  }

  /**
   * Limpar todo o cache
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.hits = 0;
    this.requests = 0;
    console.log('🗑️ UnifiedCache: Cache completamente limpo');
  }

  /**
   * Obter estatísticas do cache
   */
  getStats(): CacheStats {
    const expired = Array.from(this.cache.values()).filter(
      entry => Date.now() - entry.timestamp > this.TTL
    ).length;

    // Estimar uso de memória (aproximado)
    const estimatedSize = this.cache.size * 2; // KB aproximado por entrada
    const memoryUsage = estimatedSize > 1024 
      ? `${(estimatedSize / 1024).toFixed(1)} MB`
      : `${estimatedSize} KB`;

    return {
      totalEntries: this.cache.size,
      memoryUsage,
      expiredEntries: expired,
      hitRate: this.requests > 0 ? Math.round((this.hits / this.requests) * 100) : 0
    };
  }

  /**
   * Verificar se uma entrada específica existe
   */
  has(instanceId: string, messageId: string, mediaKey?: string): boolean {
    const key = this.generateKey(instanceId, messageId, mediaKey);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // Verificar se não expirou
    return (Date.now() - entry.timestamp) <= this.TTL;
  }

  /**
   * Remover entrada específica
   */
  delete(instanceId: string, messageId: string, mediaKey?: string): boolean {
    const key = this.generateKey(instanceId, messageId, mediaKey);
    const entry = this.cache.get(key);
    
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.cache.delete(key);
      console.log('🗑️ UnifiedCache: Removeu entrada -', key);
      return true;
    }
    
    return false;
  }

  /**
   * Obter informações de uma entrada
   */
  getInfo(instanceId: string, messageId: string, mediaKey?: string): Omit<CacheEntry, 'url'> | null {
    const key = this.generateKey(instanceId, messageId, mediaKey);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    return {
      timestamp: entry.timestamp,
      strategy: entry.strategy,
      mimeType: entry.mimeType
    };
  }

  /**
   * Log do status atual do cache
   */
  logStatus(): void {
    const stats = this.getStats();
    console.log('📊 UnifiedCache Status:', {
      entries: stats.totalEntries,
      memory: stats.memoryUsage,
      hitRate: `${stats.hitRate}%`,
      expired: stats.expiredEntries
    });
  }
}

// Singleton instance
export const unifiedMediaCache = new UnifiedMediaCache();

// Auto-limpeza a cada 5 minutos
setInterval(() => {
  unifiedMediaCache.cleanExpired();
}, 5 * 60 * 1000);