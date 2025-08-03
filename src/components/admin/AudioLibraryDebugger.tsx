import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TestTube, Play, Database, Volume2 } from 'lucide-react';

export const AudioLibraryDebugger = () => {
  const [testing, setTesting] = useState(false);
  const [clientId, setClientId] = useState('35f36a03-39b2-412c-bba6-01fdd45c2dd3');
  const [testCommand, setTestCommand] = useState('audiogeo:');
  const [debugResults, setDebugResults] = useState<any>(null);
  const [libraryData, setLibraryData] = useState<any>(null);

  const testAudioLibraryMatching = async () => {
    setTesting(true);
    setDebugResults(null);
    setLibraryData(null);

    try {
      console.log('🧪 [AUDIO-LIB-DEBUG] Iniciando teste completo da biblioteca de áudio...');
      
      // 1. Buscar assistentes com biblioteca de áudio
      console.log('📚 [AUDIO-LIB-DEBUG] Buscando assistentes...');
      const { data: allAssistants, error: assistantsError } = await supabase
        .from('assistants')
        .select('id, name, advanced_settings')
        .eq('client_id', clientId);

      if (assistantsError) {
        throw new Error(`Erro ao buscar assistentes: ${assistantsError.message}`);
      }

      if (!allAssistants || allAssistants.length === 0) {
        throw new Error('Nenhum assistente encontrado para este cliente');
      }

      // Filtrar assistentes que têm biblioteca de áudio no JavaScript
      const assistants = allAssistants.filter(assistant => {
        const advancedSettings = assistant.advanced_settings as any;
        const audioLibrary = advancedSettings?.audio_library;
        return Array.isArray(audioLibrary) && audioLibrary.length > 0;
      });

      console.log('🔍 [AUDIO-LIB-DEBUG] Resultado da busca:', {
        totalAssistants: allAssistants.length,
        withAudioLibrary: assistants.length,
        assistantNames: assistants.map(a => a.name)
      });

      if (assistants.length === 0) {
        throw new Error('Nenhum assistente com biblioteca de áudio encontrado');
      }

      // Pegar o primeiro assistente que tem biblioteca
      const assistant = assistants[0];
      const audioLibrary = (assistant.advanced_settings as any)?.audio_library || [];

      console.log('✅ [AUDIO-LIB-DEBUG] Biblioteca encontrada:', {
        assistantId: assistant.id,
        assistantName: assistant.name,
        triggersCount: Array.isArray(audioLibrary) ? audioLibrary.length : 0,
        triggers: Array.isArray(audioLibrary) ? audioLibrary.map((item: any) => item.trigger) : []
      });

      setLibraryData({
        name: assistant.name,
        audio_triggers: audioLibrary
      });

      // 2. Extrair comando de teste (remover dois pontos)
      const commandToTest = testCommand.replace(':', '').trim();
      console.log('🎯 [AUDIO-LIB-DEBUG] Testando comando:', commandToTest);

      // 3. Simular a lógica de matching
      const triggers = Array.isArray(audioLibrary) ? audioLibrary : [];
      const availableTriggers = triggers.map((item: any) => item.trigger);
      
      console.log('🔍 [AUDIO-LIB-DEBUG] Triggers disponíveis:', availableTriggers);

      // Testar diferentes tipos de match
      const matchResults = {
        exactMatch: null as string | null,
        triggerContainsSearch: [] as string[],
        searchContainsTrigger: [] as string[],
        withoutAudioPrefix: [] as string[],
        withAudioPrefix: [] as string[]
      };

      // 1. Match exato
      if (availableTriggers.includes(commandToTest)) {
        matchResults.exactMatch = commandToTest;
        console.log('✅ [AUDIO-LIB-DEBUG] Match exato encontrado:', commandToTest);
      }

      // 2. Trigger contém a busca
      for (const trigger of availableTriggers) {
        if (trigger.includes(commandToTest) && commandToTest.length >= 4) {
          matchResults.triggerContainsSearch.push(trigger);
          console.log('🎯 [AUDIO-LIB-DEBUG] Trigger contém busca:', trigger);
        }
      }

      // 3. Busca contém trigger
      for (const trigger of availableTriggers) {
        if (commandToTest.includes(trigger) && trigger.length >= 4) {
          matchResults.searchContainsTrigger.push(trigger);
          console.log('🎯 [AUDIO-LIB-DEBUG] Busca contém trigger:', trigger);
        }
      }

      // 4. Sem prefixo "audio"
      const withoutAudio = commandToTest.replace(/^audio/i, '');
      if (withoutAudio !== commandToTest && withoutAudio.length >= 3) {
        for (const trigger of availableTriggers) {
          if (trigger.includes(withoutAudio)) {
            matchResults.withoutAudioPrefix.push(trigger);
            console.log('🎯 [AUDIO-LIB-DEBUG] Match sem prefixo audio:', trigger);
          }
        }
      }

      // 5. Com prefixo "audio"
      const withAudio = `audio${commandToTest}`;
      for (const trigger of availableTriggers) {
        if (trigger.includes(withAudio)) {
          matchResults.withAudioPrefix.push(trigger);
          console.log('🎯 [AUDIO-LIB-DEBUG] Match com prefixo audio:', trigger);
        }
      }

      // Determinar melhor match
      let bestMatch = null;
      let matchType = '';

      if (matchResults.exactMatch) {
        bestMatch = matchResults.exactMatch;
        matchType = 'Exact Match';
      } else if (matchResults.triggerContainsSearch.length > 0) {
        bestMatch = matchResults.triggerContainsSearch[0];
        matchType = 'Trigger Contains Search';
      } else if (matchResults.searchContainsTrigger.length > 0) {
        bestMatch = matchResults.searchContainsTrigger[0];
        matchType = 'Search Contains Trigger';
      } else if (matchResults.withoutAudioPrefix.length > 0) {
        bestMatch = matchResults.withoutAudioPrefix[0];
        matchType = 'Without Audio Prefix';
      } else if (matchResults.withAudioPrefix.length > 0) {
        bestMatch = matchResults.withAudioPrefix[0];
        matchType = 'With Audio Prefix';
      }

      console.log('🎯 [AUDIO-LIB-DEBUG] Melhor match:', { bestMatch, matchType });

      // 4. Testar se o áudio existe
      let audioData = null;
      if (bestMatch) {
        const audioItem = triggers.find((item: any) => item.trigger === bestMatch);
        if (audioItem) {
          audioData = audioItem;
          console.log('🎵 [AUDIO-LIB-DEBUG] Áudio encontrado:', {
            trigger: bestMatch,
            hasBase64: !!audioData?.audioBase64,
            base64Size: audioData?.audioBase64?.length || 0
          });
        }
      }

      // 5. Testar a edge function AI Assistant
      console.log('🚀 [AUDIO-LIB-DEBUG] Testando edge function...');
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          message: testCommand,
          chat_id: '554796451886@s.whatsapp.net',
          instance_id: '01K11NBE1QB0GVFMME8NA4YPCB',
          client_id: clientId,
          debug: true
        }
      });

      if (aiError) {
        console.error('❌ [AUDIO-LIB-DEBUG] Erro na edge function:', aiError);
      }

      console.log('📊 [AUDIO-LIB-DEBUG] Resultado da edge function:', aiResult);

      // Compilar resultados
      const results = {
        library: {
          found: !!assistant,
          name: assistant?.name,
          triggersCount: availableTriggers.length,
          triggers: availableTriggers
        },
        matching: {
          command: commandToTest,
          bestMatch,
          matchType,
          allMatches: matchResults
        },
        audio: {
          found: !!audioData,
          trigger: bestMatch,
          hasBase64: !!audioData?.audioBase64,
          base64Size: audioData?.audioBase64?.length || 0
        },
        edgeFunction: {
          success: !aiError,
          result: aiResult,
          error: aiError?.message
        }
      };

      setDebugResults(results);

      toast.success('Teste da biblioteca de áudio concluído!');

    } catch (error: any) {
      console.error('💥 [AUDIO-LIB-DEBUG] Erro no teste:', error);
      toast.error(`Erro no teste: ${error.message}`);
      setDebugResults({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Debug da Biblioteca de Áudio
        </CardTitle>
        <CardDescription>
          Teste completo para diagnosticar problemas com áudios da biblioteca
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Client ID</label>
            <Input 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID para teste"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Comando de Teste</label>
            <Input 
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              placeholder="Ex: audiogeo:"
            />
          </div>
        </div>

        <Button 
          onClick={testAudioLibraryMatching}
          disabled={testing}
          className="w-full"
        >
          <TestTube className="h-4 w-4 mr-2" />
          {testing ? 'Testando...' : 'Executar Teste Completo'}
        </Button>

        {libraryData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📚 Biblioteca Encontrada</CardTitle>
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
              <CardTitle className="text-sm">🧪 Resultados do Teste</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={JSON.stringify(debugResults, null, 2)}
                readOnly
                className="min-h-[400px] font-mono text-xs"
              />
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};