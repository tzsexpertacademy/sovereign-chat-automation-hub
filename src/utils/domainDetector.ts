/**
 * Utilitário para detectar e corrigir domínio Lovable automaticamente
 * Resolve problemas de CORS detectando a origem atual
 */

export interface DomainInfo {
  current: string;
  isLovableApp: boolean;
  isLovableProject: boolean;
  isLocalhost: boolean;
  corsOrigins: string[];
}

export class DomainDetector {
  private static instance: DomainDetector;
  private cachedInfo: DomainInfo | null = null;

  static getInstance(): DomainDetector {
    if (!DomainDetector.instance) {
      DomainDetector.instance = new DomainDetector();
    }
    return DomainDetector.instance;
  }

  /**
   * Detecta informações sobre o domínio atual
   */
  detectCurrentDomain(): DomainInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    
    const info: DomainInfo = {
      current: currentOrigin,
      isLovableApp: currentOrigin.includes('.lovable.app'),
      isLovableProject: currentOrigin.includes('.lovableproject.com'),
      isLocalhost: currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1'),
      corsOrigins: this.generateCorsOrigins(currentOrigin)
    };

    console.log('🌐 [DOMAIN-DETECTOR] Domínio detectado:', info);
    this.cachedInfo = info;
    return info;
  }

  /**
   * Gera lista de origens CORS baseada no domínio atual
   */
  private generateCorsOrigins(currentOrigin: string): string[] {
    const origins = [
      'https://ymygyagbvbsdfkduxmgu.supabase.co' // Sempre incluir Supabase
    ];

    // Adicionar domínio atual
    if (currentOrigin) {
      origins.push(currentOrigin);
    }

    // Adicionar variações conhecidas do Lovable
    const projectId = '19c6b746-780c-41f1-97e3-86e1c8f2c488';
    origins.push(
      `https://${projectId}.lovableproject.com`,
      `https://id-preview--${projectId}.lovable.app`,
      `https://staging--${projectId}.lovable.app`
    );

    // Adicionar localhost para desenvolvimento
    origins.push('http://localhost:3000', 'http://localhost:8080');

    // Remover duplicatas
    return Array.from(new Set(origins));
  }

  /**
   * Atualiza configuração de CORS baseada no domínio atual
   */
  updateCorsConfiguration(): { updated: boolean; corsOrigins: string[] } {
    const domainInfo = this.detectCurrentDomain();
    
    // Atualizar variáveis de ambiente se necessário
    if (typeof window !== 'undefined' && domainInfo.current) {
      // Salvar domínio atual no localStorage para outros serviços
      localStorage.setItem('current_domain', domainInfo.current);
      localStorage.setItem('cors_origins', JSON.stringify(domainInfo.corsOrigins));
    }

    console.log('✅ [DOMAIN-DETECTOR] CORS atualizado:', domainInfo.corsOrigins);
    
    return {
      updated: true,
      corsOrigins: domainInfo.corsOrigins
    };
  }

  /**
   * Verifica se o domínio atual é suportado
   */
  isCurrentDomainSupported(): boolean {
    const info = this.detectCurrentDomain();
    return info.isLovableApp || info.isLovableProject || info.isLocalhost;
  }

  /**
   * Obtém URL de webhook correta baseada no domínio atual
   */
  getCorrectWebhookUrl(): string {
    const baseUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1';
    return `${baseUrl}/yumer-webhook`;
  }

  /**
   * Valida se uma origem está na lista de CORS permitidas
   */
  isOriginAllowed(origin: string): boolean {
    const info = this.detectCurrentDomain();
    return info.corsOrigins.includes(origin);
  }

  /**
   * Limpa cache - força nova detecção
   */
  clearCache(): void {
    this.cachedInfo = null;
  }
}

// Instância singleton
export const domainDetector = DomainDetector.getInstance();

// Auto-detecção na inicialização
if (typeof window !== 'undefined') {
  // Detectar domínio na inicialização
  domainDetector.detectCurrentDomain();
  domainDetector.updateCorsConfiguration();
  
  console.log('🚀 [DOMAIN-DETECTOR] Inicializado com domínio:', domainDetector.detectCurrentDomain().current);
}