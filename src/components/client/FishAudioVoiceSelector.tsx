import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Volume2, TestTube, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fishAudioService, type FishAudioVoice } from "@/services/fishAudioService";

interface FishAudioVoiceSelectorProps {
  apiKey: string;
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
}

const FishAudioVoiceSelector = ({ 
  apiKey, 
  selectedVoiceId, 
  onVoiceChange 
}: FishAudioVoiceSelectorProps) => {
  const [voices, setVoices] = useState<FishAudioVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const loadVoices = async () => {
    if (!apiKey) return;

    setLoading(true);
    try {
      console.log('🐟 Carregando vozes do Fish.Audio...');
      const voicesList = await fishAudioService.listVoices(apiKey);
      
      console.log('🐟 Vozes carregadas:', {
        total: voicesList.length,
        samples: voicesList.slice(0, 3).map(v => ({ id: v.id, name: v.name }))
      });
      
      setVoices(voicesList);
      
      if (voicesList.length > 0) {
        toast({
          title: "Vozes Carregadas",
          description: `${voicesList.length} vozes disponíveis do Fish.Audio`,
        });
      }
    } catch (error: any) {
      console.error('🐟 Erro ao carregar vozes:', error);
      toast({
        title: "Erro ao Carregar Vozes",
        description: error.message || "Não foi possível carregar as vozes do Fish.Audio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testVoice = async () => {
    if (!selectedVoiceId || !apiKey) {
      toast({
        title: "Configuração Incompleta",
        description: "Selecione uma voz primeiro",
        variant: "destructive",
      });
      return;
    }

    setTestingVoice(true);
    try {
      // Parar áudio anterior se estiver tocando
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      console.log('🐟 Testando voz:', { voiceId: selectedVoiceId });
      
      const audioBase64 = await fishAudioService.testVoice(
        apiKey,
        selectedVoiceId,
        "Olá! Esta é uma demonstração da voz clonada do Fish Audio. Como você acha que ficou?"
      );

      if (audioBase64) {
        // Converter base64 para blob e reproduzir
        const byteCharacters = atob(audioBase64);
        const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
        };
        
        setCurrentAudio(audio);
        await audio.play();
        
        toast({
          title: "Teste de Voz Fish.Audio",
          description: "Reproduzindo amostra da voz selecionada",
        });
      }
    } catch (error: any) {
      console.error('🐟 Erro no teste de voz:', error);
      toast({
        title: "Erro no Teste",
        description: error.message || "Não foi possível testar a voz",
        variant: "destructive",
      });
    } finally {
      setTestingVoice(false);
    }
  };

  const getSelectedVoice = () => {
    return voices.find(voice => voice.id === selectedVoiceId);
  };

  useEffect(() => {
    loadVoices();
  }, [apiKey]);

  // Limpar áudio ao desmontar componente
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Seleção de Voz Fish.Audio</h4>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadVoices}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Carregando vozes...</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Select value={selectedVoiceId} onValueChange={onVoiceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz..." />
                </SelectTrigger>
                <SelectContent>
                  {voices
                    .sort((a, b) => {
                      // Priorizar vozes pessoais
                      if (a.category === 'personal' && b.category !== 'personal') return -1;
                      if (b.category === 'personal' && a.category !== 'personal') return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex items-center space-x-2">
                        <div>
                          <div className="font-medium">{voice.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center space-x-1">
                            <Badge 
                              variant={voice.category === 'personal' ? 'default' : 'outline'} 
                              className="text-xs"
                            >
                              {voice.category === 'personal' ? 'Sua Voz' : voice.category}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {voice.language}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVoiceId && getSelectedVoice() && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{getSelectedVoice()?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getSelectedVoice()?.description}
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getSelectedVoice()?.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getSelectedVoice()?.language}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testVoice}
                  disabled={testingVoice}
                >
                  {testingVoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              {voices.length > 0 ? (
                `${voices.length} vozes disponíveis`
              ) : (
                "Nenhuma voz encontrada. Verifique sua API Key."
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FishAudioVoiceSelector;