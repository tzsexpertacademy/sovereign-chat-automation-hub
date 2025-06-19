import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Filter, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SystemLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const logs = [
    {
      id: "1",
      timestamp: "2024-01-19 14:32:15",
      level: "info" as const,
      component: "WhatsApp Instance",
      clientId: "client_001",
      clientName: "Empresa ABC",
      message: "Conexão estabelecida com sucesso",
      details: "Session ID: sess_abc123"
    },
    {
      id: "2",
      timestamp: "2024-01-19 14:31:45",
      level: "warning" as const,
      component: "Message Queue",
      clientId: "client_002",
      clientName: "Loja XYZ",
      message: "Alta latência detectada na fila de mensagens",
      details: "Tempo de resposta: 5.2s (limite: 3s)"
    },
    {
      id: "3",
      timestamp: "2024-01-19 14:30:22",
      level: "error" as const,
      component: "WhatsApp Instance",
      clientId: "client_003",
      clientName: "Consultoria DEF",
      message: "Falha na conexão - QR Code expirado",
      details: "Tentativa de reconexão agendada para 14:45"
    },
    {
      id: "4",
      timestamp: "2024-01-19 14:29:33",
      level: "success" as const,
      component: "Database",
      clientId: "system",
      clientName: "Sistema",
      message: "Backup automático concluído",
      details: "287MB de dados salvos com sucesso"
    },
    {
      id: "5",
      timestamp: "2024-01-19 14:28:17",
      level: "info" as const,
      component: "Campaign Engine",
      clientId: "client_001",
      clientName: "Empresa ABC",
      message: "Campanha 'Promoção Janeiro' iniciada",
      details: "450 contatos na lista de envio"
    },
    {
      id: "6",
      timestamp: "2024-01-19 14:27:05",
      level: "warning" as const,
      component: "API Rate Limiter",
      clientId: "client_004",
      clientName: "E-commerce GHI",
      message: "Rate limit próximo ao limite",
      details: "248/300 requests utilizados na última hora"
    },
    {
      id: "7",
      timestamp: "2024-01-19 14:25:44",
      level: "info" as const,
      component: "User Authentication",
      clientId: "client_002",
      clientName: "Loja XYZ",
      message: "Login realizado com sucesso",
      details: "IP: 192.168.1.100, User Agent: Chrome/120.0"
    },
    {
      id: "8",
      timestamp: "2024-01-19 14:24:12",
      level: "error" as const,
      component: "Message Processor",
      clientId: "client_003",
      clientName: "Consultoria DEF",
      message: "Falha no processamento de mensagem",
      details: "Erro de formatação na mensagem de mídia"
    }
  ];

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
      case 'error':
        return "destructive";
      case 'warning':
        return "secondary";
      case 'success':
        return "default";
      case 'info':
        return "outline";
      default:
        return "outline";
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.component.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs do Sistema</h1>
          <p className="text-gray-600">Monitore eventos e atividades do sistema</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar Logs
        </Button>
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Logs de Eventos</CardTitle>
              <CardDescription>Histórico detalhado de todas as atividades</CardDescription>
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
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="warning">Avisos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="info">Informação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-mono text-gray-500">{log.timestamp}</span>
                        <Badge variant={getLevelBadge(log.level)} className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium text-gray-600">{log.component}</span>
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{log.message}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Cliente: {log.clientName}</span>
                        <span>ID: {log.clientId}</span>
                      </div>
                      {log.details && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-100 p-2 rounded font-mono">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum log encontrado com os filtros aplicados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogs;
