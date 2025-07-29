/**
 * Gerenciador Centralizado de Status Online
 * Evita conflitos entre múltiplos sistemas
 */

interface OnlineStatusLock {
  chatId: string;
  instanceId: string;
  lockedBy: 'ai' | 'user' | 'system';
  timestamp: number;
  expiresAt: number;
}

class OnlineStatusManager {
  private static instance: OnlineStatusManager;
  private locks = new Map<string, OnlineStatusLock>();
  private readonly LOCK_DURATION = 30000; // 30 segundos

  private constructor() {}

  static getInstance(): OnlineStatusManager {
    if (!OnlineStatusManager.instance) {
      OnlineStatusManager.instance = new OnlineStatusManager();
    }
    return OnlineStatusManager.instance;
  }

  // Verificar se chat está bloqueado
  isLocked(chatId: string, instanceId: string): boolean {
    const key = `${instanceId}:${chatId}`;
    const lock = this.locks.get(key);
    
    if (!lock) return false;
    
    // Limpar locks expirados
    if (Date.now() > lock.expiresAt) {
      this.locks.delete(key);
      return false;
    }
    
    return true;
  }

  // Tentar obter lock
  acquireLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system'): boolean {
    const key = `${instanceId}:${chatId}`;
    
    if (this.isLocked(chatId, instanceId)) {
      const lock = this.locks.get(key);
      console.log(`🔒 [STATUS-MANAGER] Chat já bloqueado por: ${lock?.lockedBy}`);
      return false;
    }

    const lock: OnlineStatusLock = {
      chatId,
      instanceId,
      lockedBy: source,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.LOCK_DURATION
    };

    this.locks.set(key, lock);
    console.log(`🔓 [STATUS-MANAGER] Lock adquirido por: ${source} para ${chatId}`);
    return true;
  }

  // Liberar lock
  releaseLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system'): void {
    const key = `${instanceId}:${chatId}`;
    const lock = this.locks.get(key);
    
    if (lock && lock.lockedBy === source) {
      this.locks.delete(key);
      console.log(`🔓 [STATUS-MANAGER] Lock liberado por: ${source} para ${chatId}`);
    }
  }

  // Forçar liberação de todos os locks (emergência)
  clearAllLocks(): void {
    this.locks.clear();
    console.log('🧹 [STATUS-MANAGER] Todos os locks foram limpos');
  }

  // Status atual
  getStatus() {
    return {
      activeLocks: this.locks.size,
      locks: Array.from(this.locks.entries()).map(([key, lock]) => ({
        key,
        ...lock
      }))
    };
  }
}

export const onlineStatusManager = OnlineStatusManager.getInstance();