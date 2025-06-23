
interface MonitoringMetrics {
  messagesReceived: number;
  messagesProcessed: number;
  messagesSent: number;
  errors: number;
  lastActivity: Date;
  processingTimes: number[];
}

class AssistantMonitoringService {
  private metrics: MonitoringMetrics = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesSent: 0,
    errors: 0,
    lastActivity: new Date(),
    processingTimes: []
  };

  private healthChecks: Array<() => boolean> = [];

  // Registrar atividade
  recordMessageReceived() {
    this.metrics.messagesReceived++;
    this.metrics.lastActivity = new Date();
    console.log('📊 MÉTRICA: Mensagem recebida', this.metrics.messagesReceived);
  }

  recordMessageProcessed(processingTimeMs: number) {
    this.metrics.messagesProcessed++;
    this.metrics.processingTimes.push(processingTimeMs);
    
    // Manter apenas os últimos 100 tempos
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift();
    }
    
    console.log('📊 MÉTRICA: Mensagem processada em', processingTimeMs, 'ms');
  }

  recordMessageSent() {
    this.metrics.messagesSent++;
    console.log('📊 MÉTRICA: Mensagem enviada', this.metrics.messagesSent);
  }

  recordError(error: Error) {
    this.metrics.errors++;
    console.error('📊 MÉTRICA: Erro registrado', error.message);
    
    // Alerta crítico se muitos erros
    if (this.metrics.errors > 10) {
      console.error('🚨 ALERTA CRÍTICO: Muitos erros detectados!', this.metrics.errors);
    }
  }

  // Verificar saúde do sistema
  getHealthStatus() {
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - this.metrics.lastActivity.getTime();
    
    const averageProcessingTime = this.metrics.processingTimes.length > 0 
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0;

    const successRate = this.metrics.messagesReceived > 0 
      ? (this.metrics.messagesSent / this.metrics.messagesReceived) * 100
      : 100;

    const health = {
      status: this.calculateHealthStatus(timeSinceLastActivity, successRate),
      metrics: this.metrics,
      timeSinceLastActivity: timeSinceLastActivity / 1000, // em segundos
      averageProcessingTime,
      successRate,
      timestamp: now.toISOString()
    };

    console.log('🏥 STATUS DE SAÚDE:', health);
    return health;
  }

  private calculateHealthStatus(timeSinceLastActivity: number, successRate: number): 'healthy' | 'warning' | 'critical' {
    if (timeSinceLastActivity > 300000) { // 5 minutos sem atividade
      return 'critical';
    }
    
    if (successRate < 80) {
      return 'critical';
    }
    
    if (successRate < 95 || timeSinceLastActivity > 120000) { // 2 minutos
      return 'warning';
    }
    
    return 'healthy';
  }

  // Adicionar verificação de saúde customizada
  addHealthCheck(check: () => boolean) {
    this.healthChecks.push(check);
  }

  // Executar todas as verificações
  runHealthChecks(): boolean {
    const results = this.healthChecks.map(check => {
      try {
        return check();
      } catch (error) {
        console.error('❌ ERRO na verificação de saúde:', error);
        return false;
      }
    });

    const allHealthy = results.every(result => result === true);
    console.log('🏥 VERIFICAÇÕES DE SAÚDE:', allHealthy ? 'TODAS OK' : 'PROBLEMAS DETECTADOS');
    
    return allHealthy;
  }

  // Resetar métricas
  resetMetrics() {
    this.metrics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesSent: 0,
      errors: 0,
      lastActivity: new Date(),
      processingTimes: []
    };
    console.log('📊 MÉTRICAS RESETADAS');
  }

  // Obter relatório detalhado
  getDetailedReport() {
    const health = this.getHealthStatus();
    const report = {
      ...health,
      recommendations: this.getRecommendations(health),
      alerts: this.getAlerts(health)
    };

    console.log('📋 RELATÓRIO DETALHADO:', report);
    return report;
  }

  private getRecommendations(health: any): string[] {
    const recommendations = [];

    if (health.successRate < 95) {
      recommendations.push('Verificar configurações de IA e conectividade');
    }

    if (health.averageProcessingTime > 15000) {
      recommendations.push('Otimizar prompts e configurações de modelo');
    }

    if (health.timeSinceLastActivity > 300) {
      recommendations.push('Verificar conexão WhatsApp e WebSocket');
    }

    return recommendations;
  }

  private getAlerts(health: any): string[] {
    const alerts = [];

    if (health.status === 'critical') {
      alerts.push('CRÍTICO: Sistema com problemas graves detectados');
    }

    if (health.metrics.errors > 5) {
      alerts.push(`ATENÇÃO: ${health.metrics.errors} erros registrados`);
    }

    return alerts;
  }
}

export const assistantMonitoringService = new AssistantMonitoringService();
