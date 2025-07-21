
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface ImportProgressModalProps {
  isOpen: boolean;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  onClose: () => void;
}

const ImportProgressModal = ({ isOpen, progress, onClose }: ImportProgressModalProps) => {
  const isCompleted = progress.current >= progress.total;
  const progressPercentage = Math.round((progress.current / progress.total) * 100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            )}
            Importação CodeChat v1.3.0
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progresso</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>

          {/* Mensagem de Status */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-700">{progress.message}</p>
            </div>
          </div>

          {/* Detalhes da Estratégia */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Estratégia Inteligente Ativa:
            </h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Debug completo da estrutura da API</li>
              <li>• Validação de números reais do WhatsApp</li>
              <li>• Filtros automáticos para conversas válidas</li>
              <li>• Fallback para múltiplos endpoints</li>
              <li>• Limite inteligente de 50 conversas por instância</li>
            </ul>
          </div>

          {/* Status Indicators */}
          {!isCompleted && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span>Processando com validação robusta...</span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Importação concluída com sucesso!</span>
            </div>
          )}

          {/* Botão de Fechar */}
          {isCompleted && (
            <div className="flex justify-end pt-2">
              <Button onClick={onClose} variant="default">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProgressModal;
