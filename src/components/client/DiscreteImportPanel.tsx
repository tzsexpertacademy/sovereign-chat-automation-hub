import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  Download, 
  RefreshCw, 
  Settings, 
  AlertTriangle, 
  Clock,
  MessageSquare,
  Trash2 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DiscreteImportPanelProps {
  isImporting: boolean;
  onImport: () => void;
  clearOldData: boolean;
  setClearOldData: (value: boolean) => void;
  importMessages: boolean;
  setImportMessages: (value: boolean) => void;
  resetAllData: boolean;
  setResetAllData: (value: boolean) => void;
}

const DiscreteImportPanel = ({
  isImporting,
  onImport,
  clearOldData,
  setClearOldData,
  importMessages,
  setImportMessages,
  resetAllData,
  setResetAllData
}: DiscreteImportPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-border/50 bg-muted/30">
      <TooltipProvider>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between text-muted-foreground hover:text-foreground py-2 h-auto"
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span className="text-xs">Ferramentas</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="p-3 space-y-3">
            {/* Seção de Importação */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Download className="w-3 h-3" />
                <span>Importação de Conversas</span>
              </div>
              
              {/* Opções de importação */}
              <div className="space-y-2 ml-5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="importMessages" 
                        checked={importMessages}
                        onCheckedChange={(checked) => setImportMessages(checked as boolean)}
                        disabled={isImporting}
                        className="h-3 w-3"
                      />
                      <label htmlFor="importMessages" className="text-xs text-muted-foreground cursor-pointer flex items-center space-x-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Incluir mensagens</span>
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Importa até 50 mensagens por conversa</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="clearOldData" 
                        checked={clearOldData}
                        onCheckedChange={(checked) => {
                          setClearOldData(checked as boolean);
                          if (checked) setResetAllData(false);
                        }}
                        disabled={isImporting || resetAllData}
                        className="h-3 w-3"
                      />
                      <label htmlFor="clearOldData" className="text-xs text-muted-foreground cursor-pointer flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Limpar dados antigos</span>
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove conversas com mais de 30 dias</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Botão de importação normal */}
              {!resetAllData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onImport}
                  disabled={isImporting}
                  className="w-full h-8 text-xs"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" />
                      Importar
                    </>
                  )}
                </Button>
              )}

              {clearOldData && !resetAllData && (
                <p className="text-xs text-orange-500 flex items-center mt-1">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Dados antigos serão removidos
                </p>
              )}
            </div>

            {/* Seção de Reset - mais discreta */}
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-2">
                <AlertTriangle className="w-3 h-3" />
                <span>Configurações Avançadas</span>
              </div>
              
              <div className="ml-5 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="resetAllData" 
                        checked={resetAllData}
                        onCheckedChange={(checked) => {
                          setResetAllData(checked as boolean);
                          if (checked) setClearOldData(false);
                        }}
                        disabled={isImporting || clearOldData}
                        className="h-3 w-3"
                      />
                      <label htmlFor="resetAllData" className="text-xs text-destructive cursor-pointer">
                        Reset completo
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-destructive">⚠️ Remove TODAS as conversas e mensagens</p>
                  </TooltipContent>
                </Tooltip>

                {resetAllData && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isImporting}
                        className="w-full h-8 text-xs"
                      >
                        {isImporting ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Executar Reset
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center space-x-2 text-destructive">
                          <AlertTriangle className="w-5 h-5" />
                          <span>Confirmar Reset Completo</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p className="font-medium">Esta ação irá:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>🗑️ <strong>APAGAR TODAS</strong> as conversas</li>
                            <li>🗑️ <strong>APAGAR TODAS</strong> as mensagens</li>
                            <li>🔄 Importar conversas do zero</li>
                            <li>📨 {importMessages ? 'Incluir mensagens do WhatsApp' : 'Apenas conversas'}</li>
                          </ul>
                          <p className="text-destructive font-medium mt-3">
                            ⚠️ Esta ação é IRREVERSÍVEL!
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onImport}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Confirmar Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </TooltipProvider>
    </div>
  );
};

export default DiscreteImportPanel;