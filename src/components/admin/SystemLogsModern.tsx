
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { systemLogsService, SystemLogEntry } from "@/services/systemLogsService";
import LogsStatsCards from "./logs/LogsStatsCards";
import LogsFiltersBar from "./logs/LogsFiltersBar";
import LogEntryCard from "./logs/LogEntryCard";
import { ScrollArea } from "@/components/ui/scroll-area";

const SystemLogsModern = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [componentFilter, setComponentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const { toast } = useToast();

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

  // Aplicar filtros sempre que logs ou filtros mudarem
  useEffect(() => {
    const filtered = systemLogsService.getLogs({
      level: levelFilter !== "all" ? levelFilter : undefined,
      component: componentFilter !== "all" ? componentFilter : undefined,
      source: sourceFilter !== "all" ? sourceFilter : undefined,
      search: searchTerm
    });
    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, componentFilter, sourceFilter]);

  // Obter componentes únicos para filtro
  const uniqueComponents = Array.from(new Set(logs.map(log => log.component))).sort();

  // Obter estatísticas dos logs
  const logStats = systemLogsService.getLogStats();

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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs do Sistema</h1>
          <p className="text-gray-600">Monitore eventos e atividades em tempo real</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* Stats Cards */}
      <LogsStatsCards stats={logStats} />

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Eventos do Sistema</CardTitle>
              <CardDescription>
                {filteredLogs.length} de {logs.length} eventos exibidos
              </CardDescription>
            </div>
          </div>
          
          {/* Filters */}
          <LogsFiltersBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            levelFilter={levelFilter}
            onLevelChange={setLevelFilter}
            componentFilter={componentFilter}
            onComponentChange={setComponentFilter}
            sourceFilter={sourceFilter}
            onSourceChange={setSourceFilter}
            onReset={handleResetFilters}
            components={uniqueComponents}
          />
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando logs...</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-3 pr-4">
                {filteredLogs.map((log) => (
                  <LogEntryCard key={log.id} log={log} />
                ))}
                
                {filteredLogs.length === 0 && !loading && (
                  <div className="text-center py-12 text-gray-500">
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
