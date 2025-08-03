import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LibraryData {
  name: string;
  audio_triggers: any[];
}

export const AudioLibraryDebugger: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [clientId, setClientId] = useState('');
  const [testCommand, setTestCommand] = useState('audiogeo:');
  const [debugResults, setDebugResults] = useState('');
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);

  const testAudioLibraryMatching = async () => {
    if (!clientId || !testCommand) {
      toast.error('Client ID e comando são obrigatórios');
      return;
    }

    setTesting(true);
    setDebugResults('');
    setLibraryData(null);

    let debugLog = '🔥 [AUDIO-LIB-DEBUG] === TESTE COMPLETO DE BIBLIOTECA DE ÁUDIO ===\n\n';

    try {
      // === ETAPA 1: BUSCAR TODOS OS ASSISTENTES ===
      debugLog += '📋 [ETAPA 1] Buscando assistentes do cliente...\n';
      const { data: allAssistants, error: assistantsError } = await supabase
        .from('assistants')
        .select('*')
        .eq('client_id', clientId);

      if (assistantsError) {
        throw new Error(`Erro ao buscar assistentes: ${assistantsError.message}`);
      }

      debugLog += `✅ Encontrados ${allAssistants?.length || 0} assistentes\n`;
      debugLog += `📝 Assistentes: ${allAssistants?.map(a => a.name).join(', ') || 'nenhum'}\n\n`;

      if (!allAssistants || allAssistants.length === 0) {
        throw new Error('❌ Nenhum assistente encontrado para este cliente');
      }

      // === ETAPA 2: VERIFICAR QUAIS TÊM BIBLIOTECA DE ÁUDIO ===
      debugLog += '📚 [ETAPA 2] Verificando bibliotecas de áudio...\n';
      const assistantsWithAudio = [];
      
      for (const assistant of allAssistants) {
        const advancedSettings = assistant.advanced_settings as any;
        const audioLibrary = advancedSettings?.audio_library;
        
        debugLog += `🔍 Assistente "${assistant.name}":\n`;
        debugLog += `   - Tem advanced_settings: ${!!advancedSettings}\n`;
        debugLog += `   - Tem audio_library: ${!!audioLibrary}\n`;
        debugLog += `   - É array: ${Array.isArray(audioLibrary)}\n`;
        debugLog += `   - Tamanho: ${Array.isArray(audioLibrary) ? audioLibrary.length : 0}\n`;
        
        if (Array.isArray(audioLibrary) && audioLibrary.length > 0) {
          assistantsWithAudio.push({
            assistant,
            audioLibrary
          });
          debugLog += `   ✅ BIBLIOTECA VÁLIDA!\n`;
          debugLog += `   📝 Triggers: ${audioLibrary.map((item: any) => item.trigger).join(', ')}\n`;
        } else {
          debugLog += `   ❌ Sem biblioteca válida\n`;
        }
        debugLog += '\n';
      }

      if (assistantsWithAudio.length === 0) {
        throw new Error('❌ Nenhum assistente com biblioteca de áudio encontrado');
      }

      debugLog += `🎯 [RESULTADO] Encontrados ${assistantsWithAudio.length} assistentes com biblioteca\n\n`;

      // === ETAPA 3: TESTAR MATCHING ===
      const { assistant, audioLibrary } = assistantsWithAudio[0];
      debugLog += `🎵 [ETAPA 3] Testando matching com assistente "${assistant.name}"...\n`;
      debugLog += `📝 Comando para testar: "${testCommand}"\n`;

      setLibraryData({
        name: assistant.name,
        audio_triggers: audioLibrary
      });

      // Extrair apenas o comando sem o ":"
      const commandToTest = testCommand.replace(':', '').trim();
      debugLog += `🧹 Comando limpo: "${commandToTest}"\n`;

      // Testar diferentes estratégias de matching
      const triggers = audioLibrary.map((item: any) => item.trigger);
      debugLog += `🔍 Triggers disponíveis: [${triggers.join(', ')}]\n\n`;

      let bestMatch = null;
      let matchMethod = '';

      // Estratégia 1: Match exato
      bestMatch = triggers.find((trigger: string) => trigger === commandToTest);
      if (bestMatch) {
        matchMethod = 'Exato';
        debugLog += `✅ MATCH EXATO encontrado: "${bestMatch}"\n`;
      } else {
        debugLog += `❌ Nenhum match exato para "${commandToTest}"\n`;

        // Estratégia 2: Contém o comando
        bestMatch = triggers.find((trigger: string) => trigger.includes(commandToTest));
        if (bestMatch) {
          matchMethod = 'Contém';
          debugLog += `✅ MATCH POR CONTEÚDO encontrado: "${bestMatch}"\n`;
        } else {
          debugLog += `❌ Nenhum match por conteúdo para "${commandToTest}"\n`;

          // Estratégia 3: Comando contém o trigger
          bestMatch = triggers.find((trigger: string) => commandToTest.includes(trigger));
          if (bestMatch) {
            matchMethod = 'Comando contém trigger';
            debugLog += `✅ MATCH REVERSO encontrado: "${bestMatch}"\n`;
          } else {
            debugLog += `❌ Nenhum match reverso para "${commandToTest}"\n`;
          }
        }
      }

      // === ETAPA 4: BUSCAR ÁUDIO ===
      let audioData = null;
      if (bestMatch) {
        debugLog += `\n🎵 [ETAPA 4] Buscando áudio para trigger "${bestMatch}"...\n`;
        const audioItem = audioLibrary.find((item: any) => item.trigger === bestMatch);
        
        if (audioItem) {
          audioData = audioItem;
          debugLog += `✅ ÁUDIO ENCONTRADO!\n`;
          debugLog += `   - ID: ${audioData.id}\n`;
          debugLog += `   - Nome: ${audioData.name}\n`;
          debugLog += `   - Trigger: ${audioData.trigger}\n`;
          debugLog += `   - Tem Base64: ${!!audioData.audioBase64}\n`;
          debugLog += `   - Tamanho Base64: ${audioData.audioBase64?.length || 0} chars\n`;
          
          if (audioData.audioBase64) {
            debugLog += `   - Preview Base64: ${audioData.audioBase64.substring(0, 50)}...\n`;
          }
        } else {
          debugLog += `❌ Áudio não encontrado para trigger "${bestMatch}"\n`;
        }
      } else {
        debugLog += `\n❌ [ETAPA 4] Pulada - nenhum trigger matched\n`;
      }

      // === ETAPA 5: TESTAR EDGE FUNCTION ===
      debugLog += `\n🤖 [ETAPA 5] Testando edge function ai-assistant-process...\n`;
      let aiTestResult = null;
      let aiError = null;

      try {
        const { data: aiData, error: aiErrorResult } = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            ticketId: '00000000-0000-0000-0000-000000000000',
            messages: [{
              content: testCommand,
              messageId: 'test_audio_lib_' + Date.now(),
              timestamp: new Date().toISOString(),
              phoneNumber: '5511999999999',
              customerName: 'Teste Audio Library'
            }],
            context: {
              chatId: '5511999999999@s.whatsapp.net',
              customerName: 'Teste Audio Library',
              phoneNumber: '5511999999999',
              batchInfo: 'Teste biblioteca de áudio'
            }
          }
        });

        if (aiErrorResult) {
          aiError = aiErrorResult;
          debugLog += `❌ Erro na edge function: ${aiErrorResult.message}\n`;
        } else {
          aiTestResult = aiData;
          debugLog += `✅ Edge function executada com sucesso!\n`;
          debugLog += `📋 Resultado: ${JSON.stringify(aiData, null, 2)}\n`;
        }
      } catch (error: any) {
        aiError = error;
        debugLog += `❌ Erro ao chamar edge function: ${error.message}\n`;
      }

      // === RESULTADO FINAL ===
      debugLog += `\n🏁 [RESULTADO FINAL] ===========================\n`;
      debugLog += `✅ Assistente encontrado: ${assistant.name}\n`;
      debugLog += `✅ Biblioteca carregada: ${audioLibrary.length} itens\n`;
      debugLog += `${bestMatch ? '✅' : '❌'} Match encontrado: ${bestMatch || 'NENHUM'}\n`;
      debugLog += `${bestMatch ? `📝 Método de match: ${matchMethod}\n` : ''}`;
      debugLog += `${audioData ? '✅' : '❌'} Áudio encontrado: ${audioData ? 'SIM' : 'NÃO'}\n`;
      debugLog += `${aiTestResult ? '✅' : '❌'} Edge function: ${aiTestResult ? 'SUCESSO' : 'ERRO'}\n`;

      setDebugResults(debugLog);

      // Toast de resultado
      if (bestMatch && audioData) {
        toast.success(`🎵 Áudio "${audioData.name}" encontrado para comando "${testCommand}"!`);
      } else {
        toast.warning('❌ Comando não encontrou áudio correspondente na biblioteca');
      }

    } catch (error: any) {
      debugLog += `\n💥 [ERRO FATAL] ${error.message}\n`;
      setDebugResults(debugLog);
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🎵 Debug de Biblioteca de Áudio</CardTitle>
          <CardDescription>
            Testa o matching de comandos de áudio com a biblioteca de triggers do assistente
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
                placeholder="audiogeo:"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={testAudioLibraryMatching} 
            disabled={testing || !clientId || !testCommand}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando Teste Completo...
              </>
            ) : (
              '🔥 Execute Full Test'
            )}
          </Button>
        </CardContent>
      </Card>

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

      {debugResults && (
        <Card>
          <CardHeader>
            <CardTitle>🔍 Resultado Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={debugResults}
              readOnly
              className="min-h-[400px] font-mono text-sm"
              placeholder="Os resultados do debug aparecerão aqui..."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};