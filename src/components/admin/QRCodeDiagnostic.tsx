import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  QrCode, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { codechatQRService } from '@/services/codechatQRService';
import { useToast } from '@/hooks/use-toast';

interface QRTestResult {
  status: 'idle' | 'testing' | 'success' | 'error' | 'warning';
  message: string;
  qrCode?: string;
  details?: any;
  duration?: number;
}

const QRCodeDiagnostic = () => {
  const [instanceName, setInstanceName] = useState(`test_${Date.now()}`);
  const [createTest, setCreateTest] = useState<QRTestResult>({ status: 'idle', message: '' });
  const [connectTest, setConnectTest] = useState<QRTestResult>({ status: 'idle', message: '' });
  const [webhookTest, setWebhookTest] = useState<QRTestResult>({ status: 'idle', message: '' });
  const [qrDirectTest, setQrDirectTest] = useState<QRTestResult>({ status: 'idle', message: '' });
  const [isRunningFullTest, setIsRunningFullTest] = useState(false);
  const { toast } = useToast();

  const getStatusIcon = (status: QRTestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: QRTestResult['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Atenção</Badge>;
      case 'testing': return <Badge variant="secondary">Testando...</Badge>;
      default: return <Badge variant="outline">Não testado</Badge>;
    }
  };

  // Teste 1: Criar instância
  const testCreateInstance = async () => {
    setCreateTest({ status: 'testing', message: 'Criando instância de teste...' });
    const startTime = Date.now();

    try {
      const result = await codechatQRService.createInstance(instanceName, `Test QR Diagnostic ${instanceName}`);
      const duration = Date.now() - startTime;

      if (result.success) {
        setCreateTest({
          status: 'success',
          message: 'Instância criada com sucesso',
          details: result,
          duration
        });
      } else {
        setCreateTest({
          status: 'error',
          message: result.error || 'Erro ao criar instância',
          details: result,
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setCreateTest({
        status: 'error',
        message: error.message,
        duration
      });
    }
  };

  // Teste 2: Conectar e obter QR
  const testConnectAndQR = async () => {
    setConnectTest({ status: 'testing', message: 'Conectando e obtendo QR Code...' });
    const startTime = Date.now();

    try {
      const result = await codechatQRService.connectInstance(instanceName);
      const duration = Date.now() - startTime;

      if (result.success) {
        if (result.qrCode) {
          setConnectTest({
            status: 'success',
            message: 'QR Code obtido com sucesso!',
            qrCode: result.qrCode,
            details: result,
            duration
          });
        } else if (result.status === 'connected') {
          setConnectTest({
            status: 'warning',
            message: 'Instância já conectada (sem QR necessário)',
            details: result,
            duration
          });
        } else {
          setConnectTest({
            status: 'warning',
            message: 'Connect OK, mas QR não encontrado - aguarde webhook',
            details: result,
            duration
          });
        }
      } else {
        setConnectTest({
          status: 'error',
          message: result.error || 'Erro ao conectar',
          details: result,
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setConnectTest({
        status: 'error',
        message: error.message,
        duration
      });
    }
  };

  // Teste 3: Webhook
  const testWebhookConfig = async () => {
    setWebhookTest({ status: 'testing', message: 'Configurando webhook...' });
    const startTime = Date.now();

    try {
      const result = await codechatQRService.configureWebhook(instanceName);
      const duration = Date.now() - startTime;

      if (result.success) {
        setWebhookTest({
          status: 'success',
          message: 'Webhook configurado com sucesso',
          details: result,
          duration
        });
      } else {
        setWebhookTest({
          status: 'error',
          message: result.error || 'Erro ao configurar webhook',
          details: result,
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setWebhookTest({
        status: 'error',
        message: error.message,
        duration
      });
    }
  };

  // Teste 4: QR Code direto
  const testQRCodeDirect = async () => {
    setQrDirectTest({ status: 'testing', message: 'Tentando QR Code via endpoint direto...' });
    const startTime = Date.now();

    try {
      const result = await codechatQRService.getQRCodeDirectly(instanceName);
      const duration = Date.now() - startTime;

      if (result.success && result.qrCode) {
        setQrDirectTest({
          status: 'success',
          message: 'QR Code obtido via endpoint direto',
          qrCode: result.qrCode,
          details: result,
          duration
        });
      } else {
        setQrDirectTest({
          status: 'warning',
          message: 'Endpoint QR direto não retornou QR',
          details: result,
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setQrDirectTest({
        status: 'error',
        message: error.message,
        duration
      });
    }
  };

  // Executar teste completo
  const runFullQRTest = async () => {
    setIsRunningFullTest(true);
    
    // Resetar estado
    setCreateTest({ status: 'idle', message: '' });
    setConnectTest({ status: 'idle', message: '' });
    setWebhookTest({ status: 'idle', message: '' });
    setQrDirectTest({ status: 'idle', message: '' });

    try {
      // Gerar novo nome de instância
      const newInstanceName = `qr_test_${Date.now()}`;
      setInstanceName(newInstanceName);

      // Executar testes em sequência
      await testCreateInstance();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testWebhookConfig();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testConnectAndQR();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await testQRCodeDirect();

      toast({
        title: "Diagnóstico QR Concluído",
        description: "Verifique os resultados dos testes abaixo",
      });
    } finally {
      setIsRunningFullTest(false);
    }
  };

  // Limpar instância de teste
  const cleanupTestInstance = async () => {
    try {
      await codechatQRService.deleteInstance(instanceName);
      toast({
        title: "Instância Removida",
        description: "Instância de teste removida com sucesso",
      });
    } catch (error) {
      console.error('Erro ao limpar instância:', error);
    }
  };

  const renderTestResult = (test: QRTestResult, title: string) => (
    <div className="p-4 border rounded space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        {getStatusBadge(test.status)}
      </div>
      
      {test.message && (
        <div className="flex items-center space-x-2">
          {getStatusIcon(test.status)}
          <span className="text-sm">{test.message}</span>
          {test.duration && (
            <span className="text-xs text-muted-foreground">
              ({test.duration}ms)
            </span>
          )}
        </div>
      )}

      {test.qrCode && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-green-600">QR Code encontrado!</p>
          <div className="p-2 bg-white border rounded text-center">
            <img 
              src={test.qrCode} 
              alt="QR Code" 
              className="max-w-[200px] max-h-[200px] mx-auto"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextElement) nextElement.style.display = 'block';
              }}
            />
            <div style={{ display: 'none' }} className="text-xs text-gray-500 p-2">
              QR Code válido (imagem não renderizável)
            </div>
          </div>
        </div>
      )}

      {test.details && (
        <details className="text-xs">
          <summary className="cursor-pointer">Ver detalhes</summary>
          <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(test.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5" />
            <span>Diagnóstico de QR Code</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={cleanupTestInstance} variant="outline" size="sm">
              Limpar Teste
            </Button>
            <Button onClick={runFullQRTest} disabled={isRunningFullTest}>
              {isRunningFullTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Teste Completo
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Nome da instância"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
          />
          <Button onClick={() => setInstanceName(`qr_test_${Date.now()}`)} variant="outline">
            Gerar Novo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTestResult(createTest, "1. Criar Instância")}
          {renderTestResult(webhookTest, "2. Configurar Webhook")}
          {renderTestResult(connectTest, "3. Conectar e QR")}
          {renderTestResult(qrDirectTest, "4. QR Endpoint Direto")}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button onClick={testCreateInstance} size="sm" variant="outline">
            Teste 1
          </Button>
          <Button onClick={testWebhookConfig} size="sm" variant="outline">
            Teste 2
          </Button>
          <Button onClick={testConnectAndQR} size="sm" variant="outline">
            Teste 3
          </Button>
          <Button onClick={testQRCodeDirect} size="sm" variant="outline">
            Teste 4
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeDiagnostic;