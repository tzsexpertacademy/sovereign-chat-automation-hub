import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TicketFilters {
  search: string;
  queues: string[];
  instances: string[];
  status: 'open' | 'closed' | 'all';
  period: '7d' | '30d' | '90d' | 'all';
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export const useTicketFilters = (clientId: string) => {
  const [filters, setFilters] = useState<TicketFilters>({
    search: '',
    queues: [],
    instances: [],
    status: 'open',
    period: 'all'
  });

  const [availableQueues, setAvailableQueues] = useState<FilterOption[]>([]);
  const [availableInstances, setAvailableInstances] = useState<FilterOption[]>([]);

  // Carregar opções de filtro
  useEffect(() => {
    if (!clientId) return;

    const loadFilterOptions = async () => {
      try {
        // Carregar filas disponíveis
        const { data: queues } = await supabase
          .from('queues')
          .select('id, name')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name');

        if (queues) {
          setAvailableQueues(
            queues.map(q => ({
              value: q.id,
              label: q.name
            }))
          );
        }

        // Carregar instâncias disponíveis
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_id, custom_name, phone_number')
          .eq('client_id', clientId)
          .order('custom_name');

        if (instances) {
          setAvailableInstances(
            instances.map(i => ({
              value: i.id,
              label: i.custom_name || i.phone_number || i.instance_id
            }))
          );
        }
      } catch (error) {
        console.error('❌ [FILTERS] Erro ao carregar opções:', error);
      }
    };

    loadFilterOptions();
  }, [clientId]);

  const updateFilter = <K extends keyof TicketFilters>(
    key: K,
    value: TicketFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      queues: [],
      instances: [],
      status: 'open',
      period: 'all'
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.queues.length > 0) count++;
    if (filters.instances.length > 0) count++;
    if (filters.period !== 'all') count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFiltersCount > 0;

  return {
    filters,
    availableQueues,
    availableInstances,
    updateFilter,
    clearFilters,
    activeFiltersCount,
    hasActiveFilters
  };
};