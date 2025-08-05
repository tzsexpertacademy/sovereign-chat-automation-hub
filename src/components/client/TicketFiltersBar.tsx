import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { TicketFilters, FilterOption } from '@/hooks/useTicketFilters';

interface TicketFiltersBarProps {
  filters: TicketFilters;
  availableQueues: FilterOption[];
  availableInstances: FilterOption[];
  onUpdateFilter: <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
}

const TicketFiltersBar: React.FC<TicketFiltersBarProps> = ({
  filters,
  availableQueues,
  availableInstances,
  onUpdateFilter,
  onClearFilters,
  activeFiltersCount
}) => {
  const periodOptions = [
    { value: 'all', label: 'Todo período' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' }
  ];

  return (
    <div className="space-y-4 bg-gradient-to-r from-muted/30 to-muted/10 p-4 rounded-lg border border-border/50">
      {/* Barra de Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input 
          placeholder="Buscar por cliente, mensagem ou telefone..." 
          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 hover-scale"
          value={filters.search}
          onChange={(e) => onUpdateFilter('search', e.target.value)}
        />
      </div>

      {/* Filtros Avançados */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <div className="p-1 rounded bg-primary/10">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <span>Filtros:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Filtro por Fila */}
          <Select
            value={filters.queues.length > 0 ? filters.queues[0] : "__all_queues__"}
            onValueChange={(value) => 
              onUpdateFilter('queues', value === "__all_queues__" ? [] : [value])
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
              <SelectValue placeholder="Todas as filas" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/50">
              <SelectItem value="__all_queues__">Todas as filas</SelectItem>
              {availableQueues.map((queue) => (
                <SelectItem key={queue.value} value={queue.value}>
                  📋 {queue.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Instância */}
          <Select
            value={filters.instances.length > 0 ? filters.instances[0] : "__all_instances__"}
            onValueChange={(value) => 
              onUpdateFilter('instances', value === "__all_instances__" ? [] : [value])
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
              <SelectValue placeholder="Todas instâncias" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/50">
              <SelectItem value="__all_instances__">Todas as instâncias</SelectItem>
              {availableInstances.map((instance) => (
                <SelectItem key={instance.value} value={instance.value}>
                  📱 {instance.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Período */}
          <Select
            value={filters.period}
            onValueChange={(value) => 
              onUpdateFilter('period', value as TicketFilters['period'])
            }
          >
            <SelectTrigger className="w-full sm:w-[160px] h-9 bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-border/50">
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  📅 {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-3 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover-scale"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Badges de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-colors">
              🔍 "{filters.search}"
              <X 
                className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive transition-colors" 
                onClick={() => onUpdateFilter('search', '')}
              />
            </Badge>
          )}
          {filters.queues.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-accent/10 text-accent-foreground border-accent/30 hover:bg-accent/20 transition-colors">
              📋 {availableQueues.find(q => q.value === filters.queues[0])?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive transition-colors" 
                onClick={() => onUpdateFilter('queues', [])}
              />
            </Badge>
          )}
          {filters.instances.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary/70 transition-colors">
              📱 {availableInstances.find(i => i.value === filters.instances[0])?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive transition-colors" 
                onClick={() => onUpdateFilter('instances', [])}
              />
            </Badge>
          )}
          {filters.period !== 'all' && (
            <Badge variant="secondary" className="text-xs bg-warning/10 text-warning border-warning/30 hover:bg-warning/20 transition-colors">
              📅 {periodOptions.find(p => p.value === filters.period)?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive transition-colors" 
                onClick={() => onUpdateFilter('period', 'all')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default TicketFiltersBar;