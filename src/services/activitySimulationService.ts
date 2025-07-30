/**
 * Serviço para simulação de atividade no WhatsApp
 * Mantém o status "online" através de atividade simulada
 */

import { onlineStatusManager } from './onlineStatusManager';

interface ActivitySession {
  instanceId: string;
  chatId: string;
  clientId: string;
  isActive: boolean;
  lastActivity: number;
  heartbeatInterval?: NodeJS.Timeout;
}

class ActivitySimulationService {
  private sessions = new Map<string, ActivitySession>();
  private readonly HEARTBEAT_INTERVAL = 25000; // 25 segundos
  private readonly INACTIVITY_TIMEOUT = 120000; // 2 minutos
  
  // Iniciar simulação de atividade para um chat
  startActivitySimulation(instanceId: string, chatId: string, clientId: string): void {
    const sessionKey = `${instanceId}:${chatId}`;
    
    // Parar sessão existente se houver
    this.stopActivitySimulation(sessionKey);
    
    const session: ActivitySession = {
      instanceId,
      chatId,
      clientId,
      isActive: true,
      lastActivity: Date.now()
    };
    
    // Configurar heartbeat
    session.heartbeatInterval = setInterval(() => {
      this.performHeartbeat(sessionKey);
    }, this.HEARTBEAT_INTERVAL);
    
    this.sessions.set(sessionKey, session);
    console.log(`🎯 [ACTIVITY-SIM] Iniciando simulação para chat: ${chatId}`);
    
    // Primeiro heartbeat imediato
    this.performHeartbeat(sessionKey);
  }
  
  // Parar simulação de atividade
  stopActivitySimulation(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
      }
      this.sessions.delete(sessionKey);
      console.log(`🛑 [ACTIVITY-SIM] Parando simulação para: ${sessionKey}`);
    }
  }
  
  // Marcar atividade real do usuário
  markUserActivity(instanceId: string, chatId: string): void {
    const sessionKey = `${instanceId}:${chatId}`;
    const session = this.sessions.get(sessionKey);
    
    if (session) {
      session.lastActivity = Date.now();
      session.isActive = true;
      console.log(`👤 [ACTIVITY-SIM] Atividade real detectada: ${chatId}`);
    }
  }
  
  // Executar heartbeat
  private async performHeartbeat(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (!session) return;
    
    const timeSinceActivity = Date.now() - session.lastActivity;
    
    // Verificar se usuário está inativo há muito tempo
    if (timeSinceActivity > this.INACTIVITY_TIMEOUT) {
      console.log(`⏰ [ACTIVITY-SIM] Usuário inativo, parando simulação: ${sessionKey}`);
      this.stopActivitySimulation(sessionKey);
      return;
    }
    
    try {
      // Simular atividade através de mensagem "invisível"
      await this.simulateInvisibleActivity(session);
      console.log(`💓 [ACTIVITY-SIM] Heartbeat enviado para: ${session.chatId}`);
    } catch (error) {
      console.error(`❌ [ACTIVITY-SIM] Erro no heartbeat:`, error);
    }
  }
  
  // Estratégia A: Manter presença apenas via reconfiguração de perfil
  private async simulateInvisibleActivity(session: ActivitySession): Promise<void> {
    const { instanceId, clientId } = session;
    
    try {
      // Estratégia A: Apenas reconfigurar perfil online para manter presença
      await onlineStatusManager.configureOnlinePresence(instanceId, clientId, 'auto-trigger');
      console.log(`🔄 [ACTIVITY-SIM] Perfil reconfigurado para: ${instanceId}`);
    } catch (error) {
      console.error(`❌ [ACTIVITY-SIM] Erro ao reconfigurar perfil:`, error);
    }
  }
  
  // Verificar se chat tem simulação ativa
  isSimulationActive(instanceId: string, chatId: string): boolean {
    const sessionKey = `${instanceId}:${chatId}`;
    return this.sessions.has(sessionKey);
  }
  
  // Parar todas as simulações
  stopAllSimulations(): void {
    for (const [sessionKey] of this.sessions) {
      this.stopActivitySimulation(sessionKey);
    }
    console.log(`🧹 [ACTIVITY-SIM] Todas as simulações foram paradas`);
  }
  
  // Status das simulações ativas
  getActiveSimulations(): Array<{ sessionKey: string; chatId: string; lastActivity: number; timeSinceActivity: number }> {
    const now = Date.now();
    return Array.from(this.sessions.entries()).map(([sessionKey, session]) => ({
      sessionKey,
      chatId: session.chatId,
      lastActivity: session.lastActivity,
      timeSinceActivity: now - session.lastActivity
    }));
  }
}

export const activitySimulationService = new ActivitySimulationService();
export default activitySimulationService;