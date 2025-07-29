/**
 * Gerenciador Centralizado de Status Online
 * Evita conflitos entre múltiplos sistemas de presença
 * 🚫 TEMPORARIAMENTE DESABILITADO: CodeChat v2.2.1 não possui endpoint /chat/presence
 */

interface OnlineStatusLock {
  chatId: string;
  instanceId: string;
  lockedBy: 'ai' | 'user' | 'system' | 'presence-keep-alive';
  timestamp: number;
  expiresAt: number;
  reason?: string;
}

class OnlineStatusManager {
  private static instance: OnlineStatusManager;
  private locks = new Map<string, OnlineStatusLock>();
  private readonly LOCK_DURATION = 30000; // 30 segundos
  private isGloballyDisabled = true; // 🚫 DESABILITADO por enquanto

  private constructor() {
    console.log('🏗️ [STATUS-MANAGER] Inicializando gerenciador (DESABILITADO - endpoint não existe)');
  }

  static getInstance(): OnlineStatusManager {
    if (!OnlineStatusManager.instance) {
      OnlineStatusManager.instance = new OnlineStatusManager();
    }
    return OnlineStatusManager.instance;
  }

  // 🚫 Status global do sistema
  isSystemDisabled(): boolean {
    return this.isGloballyDisabled;
  }

  enableSystem(): void {
    this.isGloballyDisabled = false;
    console.log('✅ [STATUS-MANAGER] Sistema habilitado');
  }

  disableSystem(reason?: string): void {
    this.isGloballyDisabled = true;
    this.clearAllLocks();
    console.log('🚫 [STATUS-MANAGER] Sistema desabilitado:', reason || 'sem motivo especificado');
  }

  // Verificar se chat está bloqueado
  isLocked(chatId: string, instanceId: string): boolean {
    if (this.isGloballyDisabled) {
      console.log('🚫 [STATUS-MANAGER] Sistema desabilitado - não há locks ativos');
      return false;
    }

    const key = `${instanceId}:${chatId}`;
    const lock = this.locks.get(key);
    
    if (!lock) return false;
    
    // Limpar locks expirados
    if (Date.now() > lock.expiresAt) {
      this.locks.delete(key);
      console.log('⏰ [STATUS-MANAGER] Lock expirado removido:', key);
      return false;
    }
    
    return true;
  }

  // Tentar obter lock
  acquireLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system' | 'presence-keep-alive'): boolean {
    if (this.isGloballyDisabled) {
      console.log('🚫 [STATUS-MANAGER] Sistema desabilitado - lock negado para:', source);
      return false;
    }

    const key = `${instanceId}:${chatId}`;
    
    if (this.isLocked(chatId, instanceId)) {
      const lock = this.locks.get(key);
      console.log(`🔒 [STATUS-MANAGER] Chat já bloqueado por: ${lock?.lockedBy} (solicitado por: ${source})`);
      return false;
    }

    const lock: OnlineStatusLock = {
      chatId,
      instanceId,
      lockedBy: source,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.LOCK_DURATION,
      reason: 'Sistema de presença ativo'
    };

    this.locks.set(key, lock);
    console.log(`🔓 [STATUS-MANAGER] Lock adquirido por: ${source} para ${chatId}`);
    return true;
  }

  // Liberar lock
  releaseLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system' | 'presence-keep-alive'): void {
    const key = `${instanceId}:${chatId}`;
    const lock = this.locks.get(key);
    
    if (lock && lock.lockedBy === source) {
      this.locks.delete(key);
      console.log(`🔓 [STATUS-MANAGER] Lock liberado por: ${source} para ${chatId}`);
    } else if (lock) {
      console.log(`⚠️ [STATUS-MANAGER] Tentativa de liberar lock de outro sistema: ${source} tentou liberar lock de ${lock.lockedBy}`);
    }
  }

  // Forçar liberação de todos os locks (emergência)
  clearAllLocks(): void {
    const count = this.locks.size;
    this.locks.clear();
    console.log(`🧹 [STATUS-MANAGER] ${count} locks foram limpos`);
  }

  // Status atual do sistema
  getStatus() {
    return {
      systemDisabled: this.isGloballyDisabled,
      activeLocks: this.locks.size,
      locks: Array.from(this.locks.entries()).map(([key, lock]) => ({
        key,
        ...lock,
        timeRemaining: Math.max(0, lock.expiresAt - Date.now())
      }))
    };
  }

  // Log de debug
  logStatus(): void {
    const status = this.getStatus();
    console.log('📊 [STATUS-MANAGER] Status atual:', {
      disabled: status.systemDisabled,
      activeLocks: status.activeLocks,
      locks: status.locks.map(l => `${l.lockedBy}:${l.chatId}`)
    });
  }
}

export const onlineStatusManager = OnlineStatusManager.getInstance();

// Inicializar como desabilitado
onlineStatusManager.disableSystem('CodeChat v2.2.1 não possui endpoint /chat/presence');