
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Smartphone,
  MessageSquare,
  Users,
  Clock,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { conversationImportService } from "@/services/conversationImportService";
import { whatsappInstanceManager } from "@/services/whatsappInstanceManager";

interface ImportProgress {
  current: number;
  total: number;
  status: string;
  errors: string[];
}

interface ImprovedConversationImportProps {
  clientId: string;
  onImportComplete?: () => void;
}

const ImprovedConversationImport = ({ clientId, onImportComplete }: ImprovedConversationImportProps) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ current: 0, total: 0, status: '', errors: [] });
  const [importStats, setImportStats] = useState<any>(null);
  const [instancesSummary, setInstancesSummary] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, [clientId]);

  const loadInitialData = async () => {
    try {
      const [stats, summary] = await Promise.all([
        conversationImportService.getImportStats(clientId),
        whatsappInstanceManager.getInstancesSummary(clientId)
      ]);

      setImportStats(stats);
      setInstancesSummary(summary);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setProgress({ current: 0, total: 0, status: 'Iniciando...', errors: [] });

      const result = await conversationImportService.importConversationsFromWhatsApp(
        clientId,
        (progressData) => {
          setProgress(progressData);
        }
      );

      toast({
        title: "Importação concluída!",
        description: `${result.success} conversas importadas, ${result.duplicates} duplicatas ignoradas, ${result.errors} erros`,
      });

      // Recarregar dados
      await loadInitialData();
      onImportComplete?.();

    } catch (error: any) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: error.message || "Falha ao importar conversas",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const canImport = instancesSummary?.connected > 0;

  return (
    <div className="space-y-6">
      {/* Status das Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Status das Instâncias WhatsApp
          </CardTitle>
          <CardDescription>
            Verificação das instâncias disponíveis para importação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instancesSummary ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{instancesSummary.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{instancesSummary.connected}</div>
                <div className="text-sm text-muted-foreground">Conectadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{instancesSummary.disconnected}</div>
                <div className="text-sm text-muted-foreground">Desconectadas</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Verificando instâncias...</p>
            </div>
          )}

          {!canImport && instancesSummary && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Nenhuma instância conectada</span>
              </div>
              <p className="text-orange-700 text-sm mt-1">
                Conecte pelo menos uma instância WhatsApp antes de importar conversas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas de Importação */}
      {importStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Estatísticas Atuais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{importStats.totalTickets}</div>
                <div className="text-sm text-muted-foreground">Conversas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{importStats.totalCustomers}</div>
                <div className="text-sm text-muted-foreground">Contatos</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Última Importação</div>
                <div className="text-sm font-medium">{formatDate(importStats.lastImport)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Conversas do WhatsApp
          </CardTitle>
          <CardDescription>
            Importação inteligente com detecção de nomes reais e prevenção de duplicatas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {importing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{progress.status}</span>
                <span className="text-sm text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              
              <Progress 
                value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} 
                className="w-full" 
              />

              {progress.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Erros encontrados:</h4>
                  {progress.errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-700">• {error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium">Importação Avançada</h3>
              <p className="text-sm text-muted-foreground">
                • Extração automática de nomes reais
                <br />• Prevenção de duplicatas
                <br />• Sincronização com contatos
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadInitialData}
                disabled={importing}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Atualizar
              </Button>
              
              <Button 
                onClick={handleImport}
                disabled={importing || !canImport}
                className="bg-green-600 hover:bg-green-700"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Importar Conversas
                  </>
                )}
              </Button>
            </div>
          </div>

          {!canImport && (
            <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded border border-orange-200">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Para importar conversas, você precisa ter pelo menos uma instância WhatsApp conectada.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades da Importação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Nomes Reais</h4>
                <p className="text-sm text-muted-foreground">
                  Extrai nomes reais das conversas automaticamente
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Sem Duplicatas</h4>
                <p className="text-sm text-muted-foreground">
                  Evita criar contatos duplicados automaticamente
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Múltiplas Instâncias</h4>
                <p className="text-sm text-muted-foreground">
                  Importa de todas as instâncias conectadas
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Progresso Visual</h4>
                <p className="text-sm text-muted-foreground">
                  Acompanhe o progresso com feedback em tempo real
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovedConversationImport;
