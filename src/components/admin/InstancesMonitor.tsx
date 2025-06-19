
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Pause, RotateCcw, Smartphone, Wifi, WifiOff } from "lucide-react";

const InstancesMonitor = () => {
  const instances = [
    {
      id: "inst_001",
      clientName: "Empresa ABC",
      clientId: "client_001",
      status: "connected",
      phoneNumber: "+55 11 99999-1234",
      sessionId: "sess_abc123",
      uptime: "2d 14h 32m",
      messages24h: 1247,
      lastActivity: "2 min",
      qrExpiry: null,
      batteryLevel: 85,
      isCharging: true
    },
    {
      id: "inst_002", 
      clientName: "Loja XYZ",
      clientId: "client_002",
      status: "connected",
      phoneNumber: "+55 11 88888-5678",
      sessionId: "sess_xyz456",
      uptime: "1d 8h 15m",
      messages24h: 856,
      lastActivity: "5 min",
      qrExpiry: null,
      batteryLevel: 92,
      isCharging: false
    },
    {
      id: "inst_003",
      clientName: "Consultoria DEF", 
      clientId: "client_003",
      status: "disconnected",
      phoneNumber: "+55 11 77777-9012",
      sessionId: null,
      uptime: "0m",
      messages24h: 0,
      lastActivity: "2h",
      qrExpiry: "15 min",
      batteryLevel: null,
      isCharging: false
    },
    {
      id: "inst_004",
      clientName: "E-commerce GHI",
      clientId: "client_004", 
      status: "connecting",
      phoneNumber: "+55 11 66666-3456",
      sessionId: "sess_ghi789",
      uptime: "0m",
      messages24h: 0,
      lastActivity: "30 seg",
      qrExpiry: "12 min",
      batteryLevel: null,
      isCharging: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  };

  const handleAction = (action: string, instanceId: string) => {
    console.log(`Executando ${action} na instância ${instanceId}`);
    // Aqui seria implementada a lógica real de controle das instâncias
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitor de Instâncias</h1>
          <p className="text-gray-600">Controle e monitore todas as conexões WhatsApp</p>
        </div>
        <Button 
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Instâncias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-gray-500">Todas as instâncias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">42</div>
            <p className="text-xs text-green-600">89% online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Desconectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">3</div>
            <p className="text-xs text-red-600">Requerem atenção</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">2</div>
            <p className="text-xs text-yellow-600">Em processo</p>
          </CardContent>
        </Card>
      </div>

      {/* Instances Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {instances.map((instance) => (
          <Card key={instance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{instance.clientName}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <Smartphone className="w-4 h-4 mr-1" />
                    {instance.phoneNumber}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                  <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                    {getStatusText(instance.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Session ID</p>
                  <p className="font-mono text-xs">{instance.sessionId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Uptime</p>
                  <p className="font-medium">{instance.uptime}</p>
                </div>
                <div>
                  <p className="text-gray-500">Mensagens 24h</p>
                  <p className="font-medium">{instance.messages24h.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Última Atividade</p>
                  <p className="font-medium">{instance.lastActivity}</p>
                </div>
              </div>

              {/* Battery Status (if connected) */}
              {instance.batteryLevel && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Bateria do Dispositivo</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-4 border border-gray-300 rounded-sm relative">
                      <div 
                        className={`h-full rounded-sm ${
                          instance.batteryLevel > 50 ? 'bg-green-500' : 
                          instance.batteryLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${instance.batteryLevel}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{instance.batteryLevel}%</span>
                    {instance.isCharging && <span className="text-xs text-green-600">⚡</span>}
                  </div>
                </div>
              )}

              {/* QR Code Expiry (if disconnected) */}
              {instance.qrExpiry && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    QR Code expira em: <span className="font-medium">{instance.qrExpiry}</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2">
                {instance.status === 'connected' ? (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAction('pause', instance.id)}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pausar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAction('restart', instance.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reiniciar
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="sm"
                    onClick={() => handleAction('start', instance.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Iniciar
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => console.log(`Abrindo logs da instância ${instance.id}`)}
                >
                  Ver Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InstancesMonitor;
