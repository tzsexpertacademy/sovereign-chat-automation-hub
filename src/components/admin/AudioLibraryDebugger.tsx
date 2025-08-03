import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle, Play, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LibraryData {
  name: string;
  audio_triggers: any[];
}

interface DiagnosticStep {
  step: number;
  name: string;
  status: 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  availableTriggers?: string;
  sendData?: any;
}

interface DiagnosticResults {
  success: boolean;
  steps: DiagnosticStep[];
  finalResult: string;
  errors: string[];
  recommendations: string[];
}

export const AudioLibraryDebugger: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [clientId, setClientId] = useState('');
  const [testCommand, setTestCommand] = useState('audio audiogeonothaliszu');
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);

  const runCompleteAudioDiagnostic = async () => {
    if (!clientId.trim() || !testCommand.trim()) {
      toast.error('Por favor, preencha o ID do cliente e o comando de teste');
      return;
    }

    setTesting(true);
    setDiagnosticResults(null);
    setLibraryData(null);

    try {
      console.log('🧪 [AUDIO-DIAGNOSTIC] Iniciando diagnóstico completo...');
      
      const { data: results, error } = await supabase.functions.invoke('test-audio-library-complete', {
        body: { clientId, testCommand }
      });

      if (error) {
        throw new Error(`Erro na função de diagnóstico: ${error.message}`);
      }

      setDiagnosticResults(results);
      
      if (results.success) {
        toast.success('✅ Diagnóstico concluído - Sistema funcionando!');
      } else {
        toast.error('❌ Problemas encontrados no diagnóstico');
      }

    } catch (error: any) {
      console.error('❌ [AUDIO-DIAGNOSTIC] Erro:', error);
      toast.error(`Erro no diagnóstico: ${error.message}`);
      setDiagnosticResults({
        success: false,
        steps: [],
        finalResult: '',
        errors: [error.message],
        recommendations: ['Verificar conectividade', 'Tentar novamente']
      });
    } finally {
      setTesting(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStepBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎵 Diagnóstico Completo de Biblioteca de Áudio
            <RefreshCw className="h-5 w-5" />
          </CardTitle>
          <CardDescription>
            Sistema avançado para diagnosticar e corrigir problemas com comandos de áudio da biblioteca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                placeholder="UUID do cliente"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="testCommand">Comando para Testar</Label>
              <Input
                id="testCommand"
                placeholder="audio audiogeonothaliszu"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={runCompleteAudioDiagnostic} 
            disabled={testing || !clientId || !testCommand}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando Diagnóstico Completo...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                🔥 Executar Diagnóstico Definitivo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {diagnosticResults && (
        <>
          {/* Status Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {diagnosticResults.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Status do Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge 
                  variant={diagnosticResults.success ? "default" : "destructive"}
                  className="text-sm"
                >
                  {diagnosticResults.success ? '✅ FUNCIONANDO' : '❌ PROBLEMAS ENCONTRADOS'}
                </Badge>
                {diagnosticResults.finalResult && (
                  <p className="text-sm text-muted-foreground">{diagnosticResults.finalResult}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Etapas do Diagnóstico */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Etapas do Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosticResults.steps.map((step) => (
                  <div key={step.step} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {getStepIcon(step.status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.step}. {step.name}</span>
                        <Badge variant={getStepBadgeVariant(step.status)} className="text-xs">
                          {step.status.toUpperCase()}
                        </Badge>
                      </div>
                      {step.result && (
                        <p className="text-sm text-green-600">{step.result}</p>
                      )}
                      {step.error && (
                        <p className="text-sm text-red-600">{step.error}</p>
                      )}
                      {step.availableTriggers && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Triggers disponíveis:</strong> {step.availableTriggers}
                        </p>
                      )}
                      {step.sendData && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Dados prontos:</strong> {step.sendData.audioName} ({step.sendData.trigger})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Erros e Recomendações */}
          {(diagnosticResults.errors.length > 0 || diagnosticResults.recommendations.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>🔧 Análise e Recomendações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {diagnosticResults.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">❌ Erros Encontrados:</h4>
                    <ul className="space-y-1">
                      {diagnosticResults.errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-500 flex items-start gap-2">
                          <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {diagnosticResults.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">💡 Recomendações:</h4>
                    <ul className="space-y-1">
                      {diagnosticResults.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-blue-600 flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {libraryData && (
        <Card>
          <CardHeader>
            <CardTitle>📚 Biblioteca Encontrada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Nome:</strong> {libraryData.name}</p>
              <p><strong>Triggers:</strong> {Array.isArray(libraryData.audio_triggers) ? libraryData.audio_triggers.length : 0}</p>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(libraryData.audio_triggers) ? libraryData.audio_triggers.map((item: any) => (
                  <Badge key={item.trigger} variant="secondary" className="text-xs">
                    {item.trigger}
                  </Badge>
                )) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};