
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Trash2, AlertTriangle, Activity, Filter, Search, Clock, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { systemLogsService, SystemLogEntry } from "@/services/systemLogsService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const SystemLogsModern = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [componentFilter, setComponentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [quickFilter, setQuickFilter] = useState("all");
  const { toast } = useToast();

  // Função para obter ícone do nível
  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle;
      case 'info': return Info;
      default: return Info;
    }
  };

  // Função para obter cor do nível
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return "text-destructive";
      case 'warning': return "text-yellow-600";
      case 'success': return "text-green-600";
      case 'info': return "text-blue-600";
      default: return "text-muted-foreground";
    }
  };

  // Carregar logs iniciais e configurar listener
  useEffect(() => {
    const unsubscribe = systemLogsService.onLogsUpdate((newLogs) => {
      setLogs(newLogs);
    });

    // Carregar logs iniciais
    const initialLogs = systemLogsService.getLogs();
    setLogs(initialLogs);

    return unsubscribe;
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      const newLogs = systemLogsService.getLogs();
      setLogs(newLogs);
    }, 5000); // Refresh a cada 5 segundos

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Aplicar filtros sempre que logs ou filtros mudarem
  useEffect(() => {
    let filtered = logs;

    // Aplicar quick filter primeiro
    if (quickFilter !== "all") {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      switch (quickFilter) {
        case "errors":
          filtered = filtered.filter(log => log.level === "error");
          break;
        case "warnings":
          filtered = filtered.filter(log => log.level === "warning");
          break;
        case "last-hour":
          filtered = filtered.filter(log => new Date(log.timestamp) >= oneHourAgo);
          break;
        case "today":
          filtered = filtered.filter(log => new Date(log.timestamp) >= oneDayAgo);
          break;
      }
    }

    // Aplicar outros filtros
    if (levelFilter !== "all") {
      filtered = filtered.filter(log => log.level === levelFilter);
    }
    if (componentFilter !== "all") {
      filtered = filtered.filter(log => log.component === componentFilter);
    }
    if (sourceFilter !== "all") {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Ordenar: erros primeiro, depois warnings, depois o resto
    filtered.sort((a, b) => {
      const levelPriority = { error: 0, warning: 1, info: 2, success: 3 };
      const aPriority = levelPriority[a.level as keyof typeof levelPriority] ?? 4;
      const bPriority = levelPriority[b.level as keyof typeof levelPriority] ?? 4;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, componentFilter, sourceFilter, quickFilter]);

  // Obter componentes únicos para filtro
  const uniqueComponents = Array.from(new Set(logs.map(log => log.component))).sort();

  // Obter estatísticas dos logs
  const logStats = systemLogsService.getLogStats();

  // Calcular estatísticas críticas
  const criticalErrors = logs.filter(log => log.level === "error").length;
  const recentErrors = logs.filter(log => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return log.level === "error" && new Date(log.timestamp) >= oneHourAgo;
  }).length;

  // Status de saúde do sistema
  const systemHealth = criticalErrors === 0 ? "healthy" : criticalErrors <= 5 ? "warning" : "critical";

  // Atualizar logs manualmente
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Force uma nova coleta de logs
      console.log('🔄 [LOGS] Atualizando logs manualmente...');
      toast({
        title: "Logs Atualizados",
        description: "Logs foram atualizados com sucesso",
      });
    } catch (error) {
      console.error('❌ [LOGS] Erro ao atualizar logs:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar logs do sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Exportar logs
  const handleExport = () => {
    try {
      const csvContent = systemLogsService.exportLogs('csv', {
        level: levelFilter !== "all" ? levelFilter : undefined,
        component: componentFilter !== "all" ? componentFilter : undefined,
        source: sourceFilter !== "all" ? sourceFilter : undefined,
        search: searchTerm
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    } catch (error) {
      toast({
        title: "Erro na Exportação",
        description: "Falha ao exportar logs",
        variant: "destructive",
      });
    }
  };

  // Limpar logs
  const handleClearLogs = () => {
    systemLogsService.clearLogs();
    toast({
      title: "Logs Limpos",
      description: "Todos os logs foram removidos",
    });
  };

  // Resetar filtros
  const handleResetFilters = () => {
    setSearchTerm("");
    setLevelFilter("all");
    setComponentFilter("all");
    setSourceFilter("all");
    setQuickFilter("all");
  };

  // Aplicar filtro rápido
  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    // Reset outros filtros quando usar quick filter
    if (filter !== "all") {
      setLevelFilter("all");
      setComponentFilter("all");
      setSourceFilter("all");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sistema Logs</h1>
          <p className="text-muted-foreground">Monitore eventos e identifique problemas em tempo real</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-refresh
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" onClick={handleClearLogs} size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Status de Saúde do Sistema */}
      <Card className={`border-l-4 ${
        systemHealth === "healthy" ? "border-l-green-500 bg-green-50/50" :
        systemHealth === "warning" ? "border-l-yellow-500 bg-yellow-50/50" :
        "border-l-red-500 bg-red-50/50"
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                systemHealth === "healthy" ? "bg-green-100 text-green-600" :
                systemHealth === "warning" ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              }`}>
                {systemHealth === "healthy" ? <CheckCircle className="w-5 h-5" /> :
                 systemHealth === "warning" ? <AlertTriangle className="w-5 h-5" /> :
                 <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold">
                  Status do Sistema: {
                    systemHealth === "healthy" ? "Saudável" :
                    systemHealth === "warning" ? "Atenção" : "Crítico"
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {criticalErrors === 0 ? "Nenhum erro crítico detectado" :
                   `${criticalErrors} erro(s) crítico(s) | ${recentErrors} na última hora`}
                </p>
              </div>
            </div>
            <Badge variant={systemHealth === "healthy" ? "default" : "destructive"}>
              {recentErrors > 0 ? `${recentErrors} recentes` : "Estável"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filtros Rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={quickFilter === "all" ? "default" : "outline"}
          onClick={() => handleQuickFilter("all")}
          size="sm"
        >
          Todos
        </Button>
        <Button
          variant={quickFilter === "errors" ? "destructive" : "outline"}
          onClick={() => handleQuickFilter("errors")}
          size="sm"
          className="relative"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Erros
          {logStats.errors > 0 && (
            <Badge className="ml-2 h-5 px-1.5" variant="destructive">
              {logStats.errors}
            </Badge>
          )}
        </Button>
        <Button
          variant={quickFilter === "warnings" ? "default" : "outline"}
          onClick={() => handleQuickFilter("warnings")}
          size="sm"
          className="relative"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Avisos
          {logStats.warnings > 0 && (
            <Badge className="ml-2 h-5 px-1.5" variant="secondary">
              {logStats.warnings}
            </Badge>
          )}
        </Button>
        <Button
          variant={quickFilter === "last-hour" ? "default" : "outline"}
          onClick={() => handleQuickFilter("last-hour")}
          size="sm"
        >
          <Clock className="w-4 h-4 mr-2" />
          Última Hora
        </Button>
        <Button
          variant={quickFilter === "today" ? "default" : "outline"}
          onClick={() => handleQuickFilter("today")}
          size="sm"
        >
          Hoje
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total de Logs", value: logStats.total, icon: Info, color: "text-blue-600" },
          { title: "Erros", value: logStats.errors, icon: XCircle, color: "text-red-600" },
          { title: "Avisos", value: logStats.warnings, icon: AlertTriangle, color: "text-yellow-600" },
          { title: "Sucessos", value: logStats.success, icon: CheckCircle, color: "text-green-600" }
        ].map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {((card.value / logStats.total) * 100 || 0).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Eventos do Sistema
                {autoRefresh && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Activity className="w-3 h-3 mr-1" />
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {filteredLogs.length} de {logs.length} eventos exibidos
                {quickFilter !== "all" && (
                  <span className="ml-2 text-primary">
                    • Filtro: {
                      quickFilter === "errors" ? "Erros" :
                      quickFilter === "warnings" ? "Avisos" :
                      quickFilter === "last-hour" ? "Última Hora" :
                      quickFilter === "today" ? "Hoje" : quickFilter
                    }
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          
          {/* Filtros Avançados */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
              </SelectContent>
            </Select>

            <Select value={componentFilter} onValueChange={setComponentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Componente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos componentes</SelectItem>
                {uniqueComponents.map((component) => (
                  <SelectItem key={component} value={component}>
                    {component}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="yumer">YUMER</SelectItem>
                <SelectItem value="supabase">Supabase</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleResetFilters} size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando logs...</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-3 pr-4">
                {filteredLogs.map((log) => {
                  const LevelIcon = getLevelIcon(log.level);
                  const isError = log.level === "error";
                  const isWarning = log.level === "warning";
                  
                  return (
                    <Card 
                      key={log.id} 
                      className={`transition-all hover:shadow-md ${
                        isError ? "border-l-4 border-l-red-500 bg-red-50/20" :
                        isWarning ? "border-l-4 border-l-yellow-500 bg-yellow-50/20" :
                        "hover:bg-muted/20"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-full ${
                            isError ? "bg-red-100 text-red-600" :
                            isWarning ? "bg-yellow-100 text-yellow-600" :
                            log.level === "success" ? "bg-green-100 text-green-600" :
                            "bg-blue-100 text-blue-600"
                          }`}>
                            <LevelIcon className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={isError ? "destructive" : isWarning ? "secondary" : "outline"}>
                                  {log.level.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {log.component}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {log.source}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.timestamp), "HH:mm:ss dd/MM")}
                              </span>
                            </div>
                            
                            <p className={`text-sm font-medium ${isError ? "text-red-900" : ""}`}>
                              {log.message}
                            </p>
                            
                            {log.details && (
                              <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-2 rounded">
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {filteredLogs.length === 0 && !loading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="mb-4">
                      <svg className="w-16 h-16 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nenhum log encontrado</h3>
                    <p className="text-sm">Ajuste os filtros ou aguarde novos eventos do sistema</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogsModern;
