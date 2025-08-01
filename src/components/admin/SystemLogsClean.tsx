/**
 * SISTEMA DE LOGS LIMPO E MODERNO
 * 
 * Interface clean para visualizar logs do smartLogsService
 * - Filtros inteligentes
 * - Performance otimizada
 * - Design moderno
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Download, Trash2, Filter } from 'lucide-react';
import { smartLogs, SmartLogEntry, LogLevel, LogComponent } from '@/services/smartLogsService';

export const SystemLogsClean: React.FC = () => {
  const [logs, setLogs] = useState<SmartLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SmartLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [componentFilter, setComponentFilter] = useState<LogComponent | 'ALL'>('ALL');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Carregar logs
  const loadLogs = () => {
    const allLogs = smartLogs.getLogs();
    setLogs(allLogs);
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = logs;

    // Filtro por nível
    if (levelFilter !== 'ALL') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filtro por componente
    if (componentFilter !== 'ALL') {
      filtered = filtered.filter(log => log.component === componentFilter);
    }

    // Filtro por busca
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        log.component.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, componentFilter, search]);

  // Auto refresh
  useEffect(() => {
    if (isAutoRefresh) {
      const interval = setInterval(loadLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isAutoRefresh]);

  // Carregar logs iniciais
  useEffect(() => {
    loadLogs();
  }, []);

  // Exportar logs
  const handleExport = () => {
    const data = smartLogs.exportLogs('json');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Limpar logs
  const handleClear = () => {
    smartLogs.clear();
    setLogs([]);
    setFilteredLogs([]);
  };

  // Obter cor do badge baseado no nível
  const getLevelBadgeVariant = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      case 'INFO': return 'default';
      case 'DEBUG': return 'outline';
      default: return 'default';
    }
  };

  // Obter estatísticas
  const stats = smartLogs.getStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Sistema de Logs</h2>
          <p className="text-muted-foreground">
            Logs inteligentes - {stats.isDevelopment ? 'Modo Desenvolvimento' : 'Modo Produção'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={isAutoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold text-blue-600">{stats.info}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Debug</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-2xl font-bold text-gray-600">{stats.debug}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="Buscar nos logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Nível</label>
              <Select value={levelFilter} onValueChange={(value: LogLevel | 'ALL') => setLevelFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os níveis</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="WARN">Warning</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="DEBUG">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Componente</label>
              <Select value={componentFilter} onValueChange={(value: LogComponent | 'ALL') => setComponentFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os componentes</SelectItem>
                  <SelectItem value="AUDIO">Audio</SelectItem>
                  <SelectItem value="MESSAGE">Message</SelectItem>
                  <SelectItem value="REALTIME">Realtime</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                  <SelectItem value="UI">UI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de logs */}
      <Card>
        <CardHeader>
          <CardTitle>
            Logs ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <Badge variant={getLevelBadgeVariant(log.level)}>
                    {log.level}
                  </Badge>
                  
                  <Badge variant="outline">
                    {log.component}
                  </Badge>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {log.message}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Object.entries(log.context).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {filteredLogs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};