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
    <div className="space-y-3">
      {/* Barra de Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input 
          placeholder="Buscar por cliente, mensagem ou telefone..." 
          className="pl-10"
          value={filters.search}
          onChange={(e) => onUpdateFilter('search', e.target.value)}
        />
      </div>

      {/* Filtros Avançados */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtros:</span>
        </div>

        {/* Filtro por Fila */}
        <Select
          value={filters.queues.length > 0 ? filters.queues[0] : "__all_queues__"}
          onValueChange={(value) => 
            onUpdateFilter('queues', value === "__all_queues__" ? [] : [value])
          }
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Todas as filas" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Todas instâncias" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                📅 {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botão Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Badges de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.search && (
            <Badge variant="secondary" className="text-xs">
              🔍 "{filters.search}"
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => onUpdateFilter('search', '')}
              />
            </Badge>
          )}
          {filters.queues.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              📋 {availableQueues.find(q => q.value === filters.queues[0])?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => onUpdateFilter('queues', [])}
              />
            </Badge>
          )}
          {filters.instances.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              📱 {availableInstances.find(i => i.value === filters.instances[0])?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => onUpdateFilter('instances', [])}
              />
            </Badge>
          )}
          {filters.period !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              📅 {periodOptions.find(p => p.value === filters.period)?.label}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
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