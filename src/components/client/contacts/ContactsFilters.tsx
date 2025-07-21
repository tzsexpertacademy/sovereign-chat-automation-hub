
/**
 * Filtros avançados para contatos
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X,
  MessageSquare,
  UserCheck,
  UserX,
  Clock,
  Calendar
} from 'lucide-react';

interface ContactsFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilters: string[];
  onFilterToggle: (filter: string) => void;
  onClearFilters: () => void;
}

const ContactsFilters = ({ 
  searchTerm, 
  onSearchChange, 
  activeFilters, 
  onFilterToggle,
  onClearFilters 
}: ContactsFiltersProps) => {
  const filterOptions = [
    { id: 'with-conversation', label: 'Com Conversa', icon: MessageSquare, color: 'bg-green-100 text-green-800' },
    { id: 'without-conversation', label: 'Sem Conversa', icon: UserX, color: 'bg-gray-100 text-gray-800' },
    { id: 'active-today', label: 'Ativos Hoje', icon: Clock, color: 'bg-orange-100 text-orange-800' },
    { id: 'new-week', label: 'Novos (7 dias)', icon: Calendar, color: 'bg-purple-100 text-purple-800' },
    { id: 'has-real-name', label: 'Nome Real', icon: UserCheck, color: 'bg-blue-100 text-blue-800' }
  ];

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="space-y-4 mb-6">
      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center text-sm text-gray-600 mr-2">
          <Filter className="w-4 h-4 mr-1" />
          Filtros:
        </div>
        
        {filterOptions.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilters.includes(filter.id);
          
          return (
            <Button
              key={filter.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterToggle(filter.id)}
              className={`text-xs ${isActive ? filter.color : ''}`}
            >
              <Icon className="w-3 h-3 mr-1" />
              {filter.label}
            </Button>
          );
        })}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {activeFilters.map((filterId) => {
            const filter = filterOptions.find(f => f.id === filterId);
            if (!filter) return null;

            return (
              <Badge
                key={filterId}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => onFilterToggle(filterId)}
              >
                {filter.label}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactsFilters;
