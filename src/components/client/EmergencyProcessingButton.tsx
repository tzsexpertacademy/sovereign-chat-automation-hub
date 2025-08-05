/**
 * Botão de Processamento de Emergência
 * Permite forçar processamento quando há demoras
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap, RefreshCw } from 'lucide-react';
import { useEmergencyProcessor } from '@/hooks/useEmergencyProcessor';
import { useToast } from '@/hooks/use-toast';

interface EmergencyProcessingButtonProps {
  clientId: string;
  chatId?: string;
  className?: string;
}

const EmergencyProcessingButton = ({ 
  clientId, 
  chatId, 
  className = '' 
}: EmergencyProcessingButtonProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { stats, forceProcessChat, manualCleanup } = useEmergencyProcessor(clientId);
  const { toast } = useToast();

  const handleForceProcess = async () => {
    if (!chatId) return;
    
    setIsProcessing(true);
    try {
      console.log('⚡ [EMERGENCY-BTN] Forçando processamento para chat:', chatId);
      
      const result = await forceProcessChat(chatId);
      
      if (result.success) {
        toast({
          title: "Processamento forçado",
          description: "Chat enviado para processamento prioritário",
        });
      } else {
        toast({
          title: "Erro no processamento",
          description: result.error || "Falha ao forçar processamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [EMERGENCY-BTN] Erro:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar processamento de emergência",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanup = async () => {
    setIsProcessing(true);
    try {
      console.log('🧹 [EMERGENCY-BTN] Executando limpeza manual');
      
      const result = await manualCleanup();
      
      if (result.success) {
        toast({
          title: "Limpeza concluída",
          description: `${result.cleaned} batches órfãos removidos`,
        });
      } else {
        toast({
          title: "Erro na limpeza",
          description: result.error || "Falha na limpeza automática",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [EMERGENCY-BTN] Erro na limpeza:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar limpeza",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Mostrar apenas se há batches órfãos ou chat específico
  const showEmergencyControls = stats.orphaned > 0 || chatId;

  if (!showEmergencyControls) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Stats dos batches */}
      {stats.orphaned > 0 && (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {stats.orphaned} órfãos
        </Badge>
      )}
      
      {stats.pending > 0 && (
        <Badge variant="outline" className="text-xs">
          {stats.pending} pendentes
        </Badge>
      )}

      {/* Botão para forçar processamento do chat atual */}
      {chatId && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleForceProcess}
          disabled={isProcessing}
          className="text-xs"
        >
          {isProcessing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          Forçar
        </Button>
      )}

      {/* Botão de limpeza se há órfãos */}
      {stats.orphaned > 0 && (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleCleanup}
          disabled={isProcessing}
          className="text-xs"
        >
          {isProcessing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          Limpar
        </Button>
      )}
    </div>
  );
};

export default EmergencyProcessingButton;