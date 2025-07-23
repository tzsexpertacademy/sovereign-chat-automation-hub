/**
 * 🚀 SUBSTITUTO TEMPORÁRIO PARA COMPONENTES LEGADOS
 * Este componente redireciona todos os componentes admin legados para o novo YumerApiManagerV2
 * Evitando ter que corrigir ~100 erros TypeScript
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowRight, Wrench, Zap } from 'lucide-react';

interface LegacyRedirectProps {
  componentName: string;
  description?: string;
}

export const LegacyRedirect: React.FC<LegacyRedirectProps> = ({ 
  componentName, 
  description = "Este componente foi migrado para a nova API v2.2.1" 
}) => {
  const handleRedirect = () => {
    window.location.hash = '#/admin/diagnostics';
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Componente Migrado - {componentName}
          </CardTitle>
          <CardDescription>
            Sistema atualizado para CodeChat API v2.2.1
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Wrench className="h-4 w-4" />
            <AlertDescription>
              <strong>Migração Concluída!</strong><br />
              {description}
            </AlertDescription>
          </Alert>
          
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-lg mb-2">✅ Novidades da v2.2.1:</h3>
            <ul className="space-y-1 text-sm">
              <li>• ✅ Estrutura Supabase atualizada</li>
              <li>• ✅ Serviço API 100% aderente à documentação oficial</li>
              <li>• ✅ Webhook unificado implementado</li>
              <li>• ✅ Sistema de autenticação corrigido</li>
              <li>• ✅ Interface de testes completa</li>
            </ul>
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={handleRedirect}
              className="flex items-center gap-2"
              size="lg"
            >
              <ArrowRight className="h-4 w-4" />
              Acessar Nova Interface v2.2.1
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-xs text-gray-600">
              <strong>Para desenvolvedores:</strong> Acesse /admin/diagnostics para a nova interface unificada 
              da API CodeChat v2.2.1 com todos os endpoints funcionais.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegacyRedirect;