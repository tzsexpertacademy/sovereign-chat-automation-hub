import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HandoffTrigger {
  keywords: string[];
  target_queue_id: string;
  enabled: boolean;
  description?: string;
}

export const useQueueTriggers = (queueId?: string) => {
  const [triggers, setTriggers] = useState<HandoffTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadTriggers = useCallback(async () => {
    if (!queueId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('queues')
        .select('handoff_triggers')
        .eq('id', queueId)
        .single();

      if (error) throw error;

      const triggersData = (data.handoff_triggers as unknown as HandoffTrigger[]) || [];
      setTriggers(triggersData);
      
    } catch (error) {
      console.error('Erro ao carregar gatilhos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar gatilhos da fila",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [queueId, toast]);

  const saveTriggers = useCallback(async (newTriggers: HandoffTrigger[]) => {
    if (!queueId) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('queues')
        .update({ 
          handoff_triggers: newTriggers as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', queueId);

      if (error) throw error;

      setTriggers(newTriggers);
      
      toast({
        title: "✅ Sucesso",
        description: "Gatilhos salvos com sucesso!"
      });
      
    } catch (error) {
      console.error('Erro ao salvar gatilhos:', error);
      toast({
        title: "Erro", 
        description: "Erro ao salvar gatilhos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [queueId, toast]);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  return {
    triggers,
    setTriggers,
    saveTriggers,
    loading,
    refetch: loadTriggers
  };
};