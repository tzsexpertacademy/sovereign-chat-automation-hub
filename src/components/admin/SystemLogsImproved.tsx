import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, RefreshCw, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { yumerWhatsappService } from "@/services/yumerWhatsappService";
import { useToast } from "@/hooks/use-toast";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  component: string;
  instanceId?: string;
  message: string;
  details?: string;
}

const SystemLogsImproved = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadLogs = async () => {
    try {
      setLoading(true);
      console.log('📋 [LOGS] Carregando logs do YUMER...');
      
      // Simulate fetching logs from YUMER API
      // In real implementation, this would call yumerWhatsAppService.getLogs()
      const mockLogs: LogEntry[] = [
        {
          id: "1",
          timestamp: new Date().toISOString(),
          level: "info",
          component: "YUMER Instance",
          instanceId: "instance_001",
          message: "Instância conectada com sucesso via YUMER",
          details: "Session estabelecida no servidor yumer.yumerflow.app:8083"
        },
        {
          id: "2", 
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: "success",
          component: "YUMER Message",
          instanceId: "instance_002", 
          message: "Mensagem enviada com sucesso",
          details: "Destino: +5511999999999, Tipo: text"
        },
        {
          id: "3",
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: "warning",
          component: "YUMER QR",
          instanceId: "instance_003",
          message: "QR Code prestes a expirar",
          details: "Tempo restante: 2 minutos"
        },
        {
          id: "4",
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: "error",
          component: "YUMER Connection",
          instanceId: "instance_004",
          message: "Falha na conexão com WhatsApp",
          details: "WebSocket error: Connection refused"
        }
      ];
      
      setLogs(mockLogs);
      console.log(`✅ [LOGS] ${mockLogs.length} logs carregados do YUMER`);
      
    } catch (error) {
      console.error('❌ [LOGS] Erro ao carregar logs do YUMER:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar logs do sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    
    // Auto-refresh logs every 30 seconds
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (level) {
      case 'error': return "destructive";
      case 'warning': return "secondary";
      case 'success': return "default";
      case 'info': return "outline";
      default: return "outline";
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR');
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.instanceId && log.instanceId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    
    return matchesSearch && matchesLevel;
  });

  const logStats = {
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warning').length,
    success: logs.filter(l => l.level === 'success').length,
    info: logs.filter(l => l.level === 'info').length
  };

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Level,Component,Instance,Message,Details',
      ...filteredLogs.map(log => 
        `${log.timestamp},${log.level},${log.component},${log.instanceId || ''},${log.message},"${log.details || ''}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Logs Exportados",
      description: "Arquivo CSV baixado com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs do Sistema YUMER</h1>
          <p className="text-gray-600">Monitore eventos e atividades em tempo real</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.total}</div>
            <p className="text-xs text-gray-500">Eventos registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{logStats.errors}</div>
            <p className="text-xs text-red-600">Requer atenção</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{logStats.warnings}</div>
            <p className="text-xs text-yellow-600">Monitorar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{logStats.success}</div>
            <p className="text-xs text-green-600">Operações OK</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{logStats.info}</div>
            <p className="text-xs text-blue-600">Informativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Logs de Eventos YUMER</CardTitle>
              <CardDescription>Histórico detalhado em tempo real</CardDescription>
            </div>
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar por nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="warning">Avisos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando logs...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-mono text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <Badge variant={getLevelBadge(log.level)} className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium text-gray-600">{log.component}</span>
                        {log.instanceId && (
                          <span className="text-xs text-gray-400">ID: {log.instanceId}</span>
                        )}
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{log.message}</p>
                      {log.details && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-100 p-2 rounded font-mono">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredLogs.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum log encontrado com os filtros aplicados</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogsImproved;