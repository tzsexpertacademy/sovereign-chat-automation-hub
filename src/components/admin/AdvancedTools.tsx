
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Database, Shield, Wrench } from "lucide-react";
import OrphanBusinessCleaner from "./OrphanBusinessCleaner";

const AdvancedTools = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Configuração do Banco</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Ferramentas para gerenciar e otimizar a base de dados.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Otimizar Tabelas
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Backup Manual
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Verificar Integridade
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Segurança</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Configurações avançadas de segurança do sistema.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Logs de Segurança
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Configurar SSL
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Auditoria de Acesso
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wrench className="w-5 h-5" />
              <span>Manutenção</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Ferramentas de manutenção e diagnóstico do sistema.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="w-4 h-4 mr-2" />
                Limpar Cache
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="w-4 h-4 mr-2" />
                Reiniciar Serviços
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="w-4 h-4 mr-2" />
                Status do Sistema
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Configurações Avançadas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Configurações avançadas do sistema e integração.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Variáveis de Ambiente
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Configurar Webhooks
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Logs de Sistema
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Limpeza de Businesses Órfãos */}
      <OrphanBusinessCleaner />
    </div>
  );
};

export default AdvancedTools;
