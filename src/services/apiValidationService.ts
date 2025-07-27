/**
 * SERVIÇO DE VALIDAÇÃO DA API CODECHAT v2.2.1
 * Valida endpoints, autenticação e estruturas de dados
 */

import { supabase } from '@/integrations/supabase/client';

interface ApiEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requiresAuth: boolean;
  expectedStatus: number[];
}

interface ValidationResult {
  endpoint: string;
  success: boolean;
  status?: number;
  error?: string;
  response?: any;
  latency?: number;
}

class ApiValidationService {
  private readonly baseUrl = 'https://api.yumer.com.br';
  
  // Endpoints principais da API v2.2.1
  private readonly endpoints: ApiEndpoint[] = [
    {
      name: 'Health Check',
      url: '/docs',
      method: 'GET',
      requiresAuth: false,
      expectedStatus: [200]
    },
    {
      name: 'Send Text Message',
      url: '/api/v2/instance/{instanceId}/send/text',
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [200, 201]
    },
    {
      name: 'Send Presence',
      url: '/api/v2/instance/{instanceId}/send/presence',
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [200, 201]
    },
    {
      name: 'Get Instance',
      url: '/api/v2/instance/{instanceId}',
      method: 'GET',
      requiresAuth: true,
      expectedStatus: [200]
    },
    {
      name: 'Instance Connect',
      url: '/api/v2/instance/{instanceId}/connect',
      method: 'GET',
      requiresAuth: true,
      expectedStatus: [200]
    }
  ];

  /**
   * Valida se a API está online e respondendo
   */
  async validateServerHealth(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🏥 [API-VALIDATION] Verificando saúde do servidor...');
      
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          endpoint: '/docs',
          success: true,
          status: response.status,
          latency
        };
      } else {
        return {
          endpoint: '/docs',
          success: false,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          latency
        };
      }
    } catch (error: any) {
      return {
        endpoint: '/docs',
        success: false,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Valida autenticação com business_token
   */
  async validateAuthentication(instanceId: string): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔐 [API-VALIDATION] Validando autenticação para instância:', instanceId);
      
      // Buscar business_token
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          business_business_id,
          clients!inner(business_token)
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        return {
          endpoint: 'authentication',
          success: false,
          error: 'Business token não encontrado',
          latency: Date.now() - startTime
        };
      }

      const businessToken = instanceData.clients.business_token;
      
      // Testar autenticação com endpoint /api/v2/instance/{instanceId}
      const response = await fetch(`${this.baseUrl}/api/v2/instance/${instanceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          endpoint: `/api/v2/instance/${instanceId}`,
          success: true,
          status: response.status,
          response: data,
          latency
        };
      } else {
        const errorText = await response.text();
        return {
          endpoint: `/api/v2/instance/${instanceId}`,
          success: false,
          status: response.status,
          error: errorText,
          latency
        };
      }
    } catch (error: any) {
      return {
        endpoint: 'authentication',
        success: false,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Testa envio de mensagem
   */
  async testSendMessage(instanceId: string, testNumber: string): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('📤 [API-VALIDATION] Testando envio de mensagem...');
      
      // Buscar business_token
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          clients!inner(business_token)
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        return {
          endpoint: 'send_text',
          success: false,
          error: 'Business token não encontrado',
          latency: Date.now() - startTime
        };
      }

      const businessToken = instanceData.clients.business_token;
      
      const testData = {
        number: testNumber,
        text: '🧪 Teste de validação da API CodeChat v2.2.1',
        options: {
          delay: 1000,
          presence: 'composing'
        }
      };
      
      const response = await fetch(`${this.baseUrl}/api/v2/instance/${instanceId}/send/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          endpoint: `/api/v2/instance/${instanceId}/send/text`,
          success: true,
          status: response.status,
          response: data,
          latency
        };
      } else {
        const errorText = await response.text();
        return {
          endpoint: `/api/v2/instance/${instanceId}/send/text`,
          success: false,
          status: response.status,
          error: errorText,
          latency
        };
      }
    } catch (error: any) {
      return {
        endpoint: 'send_text',
        success: false,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Executa validação completa da API
   */
  async runFullValidation(instanceId: string, testNumber?: string): Promise<{
    overall: boolean;
    results: ValidationResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      averageLatency: number;
    };
  }> {
    console.log('🔍 [API-VALIDATION] Iniciando validação completa da API...');
    
    const results: ValidationResult[] = [];
    
    // 1. Verificar saúde do servidor
    const healthResult = await this.validateServerHealth();
    results.push(healthResult);
    
    // 2. Validar autenticação
    const authResult = await this.validateAuthentication(instanceId);
    results.push(authResult);
    
    // 3. Testar envio de mensagem (opcional)
    if (testNumber && authResult.success) {
      const messageResult = await this.testSendMessage(instanceId, testNumber);
      results.push(messageResult);
    }
    
    // Calcular resumo
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;
    const overall = failed === 0;
    const averageLatency = results.reduce((sum, r) => sum + (r.latency || 0), 0) / results.length;
    
    const summary = {
      total: results.length,
      passed,
      failed,
      averageLatency: Math.round(averageLatency)
    };
    
    console.log('📊 [API-VALIDATION] Validação completa:', {
      overall,
      summary,
      results: results.map(r => ({ endpoint: r.endpoint, success: r.success, latency: r.latency }))
    });
    
    return {
      overall,
      results,
      summary
    };
  }

  /**
   * Valida estrutura de dados de uma resposta da API
   */
  validateResponseStructure(response: any, expectedStructure: Record<string, string>): {
    valid: boolean;
    missing: string[];
    extra: string[];
  } {
    const missing: string[] = [];
    const extra: string[] = [];
    
    // Verificar campos obrigatórios
    for (const [field, type] of Object.entries(expectedStructure)) {
      if (!(field in response)) {
        missing.push(field);
      } else if (typeof response[field] !== type) {
        missing.push(`${field} (tipo esperado: ${type}, recebido: ${typeof response[field]})`);
      }
    }
    
    // Verificar campos extras
    for (const field of Object.keys(response)) {
      if (!(field in expectedStructure)) {
        extra.push(field);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      extra
    };
  }
}

export const apiValidationService = new ApiValidationService();
export default apiValidationService;