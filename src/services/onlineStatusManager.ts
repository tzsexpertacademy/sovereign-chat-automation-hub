/**
 * Gerenciador Centralizado de Status Online
 * Sistema unificado para configurações de perfil e presença via CodeChat v2.2.1
 */

import unifiedYumerService from './unifiedYumerService';

interface OnlineStatusLock {
  chatId: string;
  instanceId: string;
  lockedBy: 'ai' | 'user' | 'system' | 'auto-trigger';
  timestamp: number;
  expiresAt: number;
  reason?: string;
}

class OnlineStatusManager {
  private static instance: OnlineStatusManager;
  private locks = new Map<string, OnlineStatusLock>();
  private readonly LOCK_DURATION = 30000; // 30 segundos
  private isGloballyDisabled = false; // ✅ HABILITADO para usar configurações de perfil

  private constructor() {
    console.log('🏗️ [STATUS-MANAGER] Inicializando gerenciador com configurações de perfil');
  }

  static getInstance(): OnlineStatusManager {
    if (!OnlineStatusManager.instance) {
      OnlineStatusManager.instance = new OnlineStatusManager();
    }
    return OnlineStatusManager.instance;
  }

  // Sistema de habilitação/desabilitação global
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

  // Função principal para configurar presença online
  async configureOnlinePresence(instanceId: string, clientId: string, source: 'ai' | 'user' | 'system' | 'auto-trigger' = 'system'): Promise<boolean> {
    if (this.isGloballyDisabled) {
      console.log('🚫 [STATUS-MANAGER] Sistema desabilitado - configuração cancelada');
      return false;
    }

    // Verificar se já está sendo processado
    if (this.isLocked('presence', instanceId)) {
      console.log(`🔒 [STATUS-MANAGER] Configuração de presença já em andamento para: ${instanceId}`);
      return false;
    }

    // Adquirir lock
    if (!this.acquireLock('presence', instanceId, source)) {
      console.log(`❌ [STATUS-MANAGER] Falha ao adquirir lock para: ${instanceId}`);
      return false;
    }

    try {
      console.log(`🔵 [STATUS-MANAGER] Iniciando configuração de presença: ${instanceId} (por ${source})`);
      
      const result = await unifiedYumerService.setOnlinePresence(instanceId, clientId);
      
      if (result.success) {
        console.log(`✅ [STATUS-MANAGER] Presença configurada com sucesso para: ${instanceId}`);
        return true;
      } else {
        console.log(`❌ [STATUS-MANAGER] Falha na configuração: ${result.error}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ [STATUS-MANAGER] Erro ao configurar presença:`, error);
      return false;
    } finally {
      this.releaseLock('presence', instanceId, source);
    }
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
  acquireLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system' | 'auto-trigger'): boolean {
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
  releaseLock(chatId: string, instanceId: string, source: 'ai' | 'user' | 'system' | 'auto-trigger'): void {
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

// Sistema habilitado para usar configurações de perfil
onlineStatusManager.enableSystem();