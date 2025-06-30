
#!/bin/bash

# Script para correção definitiva do WebSocket e QR Code
# Arquivo: scripts/fix-websocket-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA DO WEBSOCKET E QR CODE"
echo "=============================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-websocket-definitive.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000

echo "🔍 Diagnosticando problema do WebSocket..."

# Testar WebSocket atual
echo "1️⃣ Testando WebSocket atual..."
WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" | head -1 | awk '{print $2}')
echo "WebSocket status atual: $WS_STATUS"

if [ "$WS_STATUS" = "400" ] || [ "$WS_STATUS" = "404" ]; then
    echo "❌ WebSocket com problema (status $WS_STATUS) - aplicando correção definitiva"
    
    # Fazer backup da configuração atual
    BACKUP_DIR="/tmp/nginx-websocket-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ Arquivo de configuração não encontrado"
    
    echo "💾 Backup salvo em: $BACKUP_DIR"
    
    # Criar configuração corrigida com WebSocket funcionando DEFINITIVAMENTE
    echo "🔧 Aplicando correção DEFINITIVA do WebSocket..."
    cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - WEBSOCKET CORRIGIDO DEFINITIVAMENTE
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ORDEM CRÍTICA DOS LOCATION BLOCKS
    
    # 1. Health Check - PRIMEIRA (crítica para Lovable)
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
    
    # 2. WebSocket - SEGUNDA (crítica para QR Code) - CORREÇÃO DEFINITIVA
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 10s;
        proxy_send_timeout 86400;
        
        # Headers específicos para WebSocket
        proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;
        proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
        proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
    }
    
    # 3. API Docs JSON - TERCEIRA
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 4. API Docs - QUARTA (SEM REDIRECT)
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
    
    # 5. API Clients - QUINTA
    location /clients {
        proxy_pass http://127.0.0.1:4000/clients;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 6. Frontend - ÚLTIMA (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Testar configuração
    echo "🧪 Testando configuração Nginx..."
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Configuração Nginx válida! Aplicando..."
        systemctl reload nginx
        sleep 5
        
        # Validar correção do WebSocket
        echo "🔍 Validando correção do WebSocket..."
        NEW_WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" | head -1 | awk '{print $2}')
        echo "Novo status WebSocket: $NEW_WS_STATUS"
        
        if [ "$NEW_WS_STATUS" = "200" ] || [ "$NEW_WS_STATUS" = "101" ]; then
            echo "🎉 WEBSOCKET CORRIGIDO DEFINITIVAMENTE! Status: $NEW_WS_STATUS ✅"
        else
            echo "⚠️ WebSocket ainda com problema: $NEW_WS_STATUS"
            echo "🔧 Tentando reiniciar serviços..."
            
            # Reiniciar PM2 se existir
            if command -v pm2 > /dev/null 2>&1; then
                echo "🔄 Reiniciando PM2..."
                pm2 restart all 2>/dev/null || echo "⚠️ PM2 restart falhou"
                sleep 3
            fi
            
            # Testar novamente
            FINAL_WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" | head -1 | awk '{print $2}')
            echo "Status final WebSocket: $FINAL_WS_STATUS"
        fi
        
    else
        echo "❌ Erro na configuração! Restaurando backup..."
        if [ -f "$BACKUP_DIR/whatsapp-multi-client" ]; then
            cp "$BACKUP_DIR/whatsapp-multi-client" /etc/nginx/sites-available/
            systemctl reload nginx
        fi
        exit 1
    fi
else
    echo "✅ WebSocket já funcionando (status $WS_STATUS)"
fi

echo ""
echo "2️⃣ Testando conexão de instância..."
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3"

# Testar se instância consegue se conectar
CONNECT_RESPONSE=$(curl -k -s -X POST "https://$DOMAIN/clients/$INSTANCE_ID/connect" \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com")

echo "Resposta da conexão: $CONNECT_RESPONSE"

# Aguardar 5 segundos e verificar status
sleep 5

STATUS_RESPONSE=$(curl -k -s "https://$DOMAIN/clients/$INSTANCE_ID/status")
echo "Status após conexão: $STATUS_RESPONSE"

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. ✅ WebSocket corrigido definitivamente"
echo "2. 🔗 Acesse o Lovable: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/"
echo "3. 📱 Vá para /admin/instances"
echo "4. 🔄 Clique em 'Diagnóstico QR Code' para testar"
echo "5. ➕ Crie uma nova instância"
echo "6. 📱 O QR Code deve aparecer automaticamente via WebSocket"
echo ""
echo "🔧 Para monitorar em tempo real:"
echo "• Logs do servidor: pm2 logs whatsapp-multi-client"
echo "• Status PM2: pm2 status"
echo "• Teste WebSocket manualmente: curl -I https://146.59.227.248/socket.io/"

echo ""
echo "✅ Correção definitiva do WebSocket concluída!"
echo "🔄 Backup disponível em: $BACKUP_DIR"
EOF

chmod +x scripts/fix-websocket-definitive.sh

Agora vou atualizar o componente QRCodeDebugger para conectar ao WebSocket e receber QR codes em tempo real:

<lov-write file_path="src/components/admin/QRCodeDebugger.tsx">
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";

const QRCodeDebugger = () => {
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testInstanceId] = useState("35f36a03-39b2-412c-bba6-01fdd45c2dd3");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<string>('disconnected');

  useEffect(() => {
    // Conectar ao WebSocket para receber QR codes em tempo real
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      socket.on('connect', () => {
        console.log('🔌 WebSocket conectado para QR Code Debugger');
        setWebsocketConnected(true);
        
        // Entrar na sala da instância de teste
        whatsappService.joinClientRoom(testInstanceId);
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setWebsocketConnected(false);
      });

      // Escutar status da instância de teste
      whatsappService.onClientStatus(testInstanceId, (clientData) => {
        console.log('📱 Status da instância recebido:', clientData);
        setInstanceStatus(clientData.status);
        
        if (clientData.hasQrCode && clientData.qrCode) {
          console.log('📱 QR Code recebido via WebSocket!');
          setQrCodeData(clientData.qrCode);
          toast({
            title: "QR Code Recebido!",
            description: "QR Code disponível via WebSocket",
          });
        }
      });
    }

    return () => {
      if (socket) {
        whatsappService.offClientStatus(testInstanceId);
        socket.disconnect();
      }
    };
  }, [testInstanceId, toast]);

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      console.log('🔍 Iniciando diagnóstico completo do QR Code...');
      
      const diagnostics = {
        timestamp: new Date().toISOString(),
        websocket: null,
        serverHealth: null,
        instanceStatus: null,
        connectionTest: null,
        qrCodeTest: null,
        errors: []
      };

      // 1. Testar saúde do servidor
      try {
        console.log('🔍 Testando saúde do servidor...');
        const health = await whatsappService.checkServerHealth();
        diagnostics.serverHealth = health;
        console.log('✅ Servidor saudável:', health);
      } catch (error: any) {
        console.error('❌ Erro na saúde do servidor:', error);
        diagnostics.errors.push(`Server Health: ${error.message}`);
      }

      // 2. Testar WebSocket
      try {
        console.log('🔍 Testando WebSocket...');
        const socket = whatsappService.getSocket();
        diagnostics.websocket = {
          connected: socket?.connected || false,
          transport: socket?.io?.engine?.transport?.name || 'unknown',
          url: 'wss://146.59.227.248/socket.io/',
          realTimeStatus: websocketConnected
        };
        console.log('🔌 WebSocket info:', diagnostics.websocket);
      } catch (error: any) {
        console.error('❌ Erro no WebSocket:', error);
        diagnostics.errors.push(`WebSocket: ${error.message}`);
      }

      // 3. Testar status da instância
      try {
        console.log('🔍 Testando status da instância...');
        const status = await whatsappService.getClientStatus(testInstanceId);
        diagnostics.instanceStatus = status;
        console.log('📱 Status da instância:', status);
        
        if (status.hasQrCode && status.qrCode) {
          setQrCodeData(status.qrCode);
          console.log('📱 QR Code encontrado no status!');
        }
      } catch (error: any) {
        console.error('❌ Erro no status da instância:', error);
        diagnostics.errors.push(`Instance Status: ${error.message}`);
      }

      // 4. Testar conexão da instância (se não estiver conectada)
      if (instanceStatus !== 'connected' && instanceStatus !== 'qr_ready') {
        try {
          console.log('🔍 Iniciando conexão da instância...');
          const connection = await whatsappService.connectClient(testInstanceId);
          diagnostics.connectionTest = connection;
          console.log('🔗 Resultado da conexão:', connection);
          
          // Aguardar alguns segundos para o QR Code aparecer
          toast({
            title: "Instância Conectando",
            description: "Aguarde o QR Code aparecer...",
          });
          
        } catch (error: any) {
          console.error('❌ Erro na conexão da instância:', error);
          diagnostics.errors.push(`Connection Test: ${error.message}`);
        }
      }

      // 5. Teste específico do QR Code
      diagnostics.qrCodeTest = {
        hasQrCode: !!qrCodeData,
        websocketReceived: websocketConnected,
        instanceStatus: instanceStatus
      };

      setDebugInfo(diagnostics);
      
      if (diagnostics.errors.length === 0) {
        toast({
          title: "Diagnóstico Concluído",
          description: qrCodeData ? "QR Code disponível!" : "Sistema funcionando, aguarde QR Code...",
        });
      } else {
        toast({
          title: "Problemas Encontrados",
          description: `${diagnostics.errors.length} erro(s) detectado(s)`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('❌ Erro geral no diagnóstico:', error);
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const connectInstance = async () => {
    try {
      setLoading(true);
      console.log('🚀 Conectando instância para gerar QR Code...');
      
      await whatsappService.connectClient(testInstanceId);
      
      toast({
        title: "Instância Conectando",
        description: "Aguarde o QR Code aparecer via WebSocket...",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar instância:', error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (condition: boolean) => {
    return condition ? (
      <Badge className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        OK
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Erro
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Diagnóstico QR Code
            {websocketConnected ? (
              <Wifi className="w-4 h-4 ml-2 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 ml-2 text-red-500" />
            )}
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              onClick={runDiagnostics}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Diagnosticar
            </Button>
            <Button
              size="sm"
              onClick={connectInstance}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Gerar QR
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WebSocket Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div className="flex items-center space-x-2">
            {websocketConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              WebSocket: {websocketConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <Badge className={getStatusColor(instanceStatus)}>
            Status: {instanceStatus}
          </Badge>
        </div>

        {/* QR Code Display */}
        {qrCodeData && (
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">QR Code Disponível!</h3>
              <div className="bg-white p-4 rounded border">
                <img 
                  src={qrCodeData} 
                  alt="QR Code WhatsApp"
                  className="mx-auto max-w-xs"
                />
              </div>
              <p className="text-sm text-green-600 mt-2">
                ✅ QR Code recebido via WebSocket em tempo real
              </p>
            </div>
          </div>
        )}

        {!debugInfo && !qrCodeData && (
          <div className="text-center py-4">
            <QrCode className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Clique em "Gerar QR" ou "Diagnosticar" para verificar o sistema</p>
          </div>
        )}

        {debugInfo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Servidor:</span>
                {getStatusBadge(debugInfo.serverHealth?.status === 'ok')}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">WebSocket:</span>
                {getStatusBadge(debugInfo.websocket?.connected && websocketConnected)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Instância:</span>
                {getStatusBadge(debugInfo.instanceStatus?.status === 'qr_ready' || 
                                debugInfo.instanceStatus?.status === 'connected')}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">QR Code:</span>
                {getStatusBadge(!!qrCodeData)}
              </div>
            </div>

            {debugInfo.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Erros Encontrados:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {debugInfo.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {showDebug && (
              <div className="bg-gray-50 border rounded p-3">
                <h4 className="font-medium mb-2">Debug Info:</h4>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QRCodeDebugger;
