
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Loader2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { elevenLabsService, type ElevenLabsVoice, type OrganizedVoices } from "@/services/elevenLabsService";

interface ElevenLabsVoiceSelectorProps {
  apiKey: string;
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
  model: string;
}

const ElevenLabsVoiceSelector = ({ apiKey, selectedVoiceId, onVoiceChange, model }: ElevenLabsVoiceSelectorProps) => {
  const [voices, setVoices] = useState<OrganizedVoices>({ premade: [], cloned: [], professional: [] });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (apiKey) {
      loadVoices();
    }
  }, [apiKey]);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const voicesData = await elevenLabsService.fetchAllVoices(apiKey);
      setVoices(voicesData);
      
      toast({
        title: "Vozes Carregadas",
        description: `${getTotalVoices(voicesData)} vozes encontradas`,
      });
    } catch (error: any) {
      console.error('Erro ao carregar vozes:', error);
      toast({
        title: "Erro ao Carregar Vozes",
        description: error.message || "Verifique sua API key do ElevenLabs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalVoices = (voices: OrganizedVoices) => {
    return voices.premade.length + voices.cloned.length + voices.professional.length;
  };

  const getAllVoices = (): ElevenLabsVoice[] => {
    return [...voices.premade, ...voices.cloned, ...voices.professional];
  };

  const getSelectedVoice = (): ElevenLabsVoice | undefined => {
    return getAllVoices().find(voice => voice.voice_id === selectedVoiceId);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'premade': return 'Padrão';
      case 'cloned': return 'Clonada';
      case 'professional': return 'Profissional';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'premade': return 'bg-blue-100 text-blue-800';
      case 'cloned': return 'bg-green-100 text-green-800';
      case 'professional': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const testVoice = async (voiceId: string) => {
    if (testing === voiceId) {
      // Parar áudio atual
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setTesting(null);
      return;
    }

    try {
      setTesting(voiceId);
      
      const testText = "Olá! Este é um teste da minha voz. Como você acha que ficou?";
      const audioBase64 = await elevenLabsService.testVoice(apiKey, voiceId, testText, model);
      
      // Converter base64 para blob e reproduzir
      const byteCharacters = atob(audioBase64);
      const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setTesting(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setTesting(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Erro na Reprodução",
          description: "Não foi possível reproduzir o áudio de teste",
          variant: "destructive",
        });
      };
      
      await audio.play();
      
    } catch (error: any) {
      setTesting(null);
      toast({
        title: "Erro no Teste de Voz",
        description: error.message || "Não foi possível testar a voz",
        variant: "destructive",
      });
    }
  };

  const selectedVoice = getSelectedVoice();

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando vozes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">
          Selecionar Voz ({getTotalVoices(voices)} disponíveis)
        </label>
        <div className="flex space-x-2 mt-2">
          <Select value={selectedVoiceId} onValueChange={onVoiceChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione uma voz">
                {selectedVoice && (
                  <div className="flex items-center space-x-2">
                    <span>{selectedVoice.name}</span>
                    <Badge className={getCategoryColor(selectedVoice.category)} variant="secondary">
                      {getCategoryLabel(selectedVoice.category)}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {voices.premade.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    Vozes Padrão ({voices.premade.length})
                  </div>
                  {voices.premade.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      <div className="flex items-center space-x-2">
                        <span>{voice.name}</span>
                        <Badge className="bg-blue-100 text-blue-800" variant="secondary">
                          Padrão
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
              
              {voices.cloned.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    Vozes Clonadas ({voices.cloned.length})
                  </div>
                  {voices.cloned.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      <div className="flex items-center space-x-2">
                        <span>{voice.name}</span>
                        <Badge className="bg-green-100 text-green-800" variant="secondary">
                          Clonada
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
              
              {voices.professional.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    Vozes Profissionais ({voices.professional.length})
                  </div>
                  {voices.professional.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      <div className="flex items-center space-x-2">
                        <span>{voice.name}</span>
                        <Badge className="bg-purple-100 text-purple-800" variant="secondary">
                          Profissional
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          
          {selectedVoiceId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => testVoice(selectedVoiceId)}
              disabled={testing !== null}
            >
              {testing === selectedVoiceId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : testing ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {selectedVoice?.description && (
        <p className="text-sm text-muted-foreground">
          {selectedVoice.description}
        </p>
      )}

      <Button 
        variant="outline" 
        size="sm"
        onClick={loadVoices}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Volume2 className="w-4 h-4 mr-2" />
        )}
        Recarregar Vozes
      </Button>
    </div>
  );
};

export default ElevenLabsVoiceSelector;
