import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RefreshCw, Trash2, Search, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { amaraTranscriptionFixer } from '@/services/amaraTranscriptionFixer';

interface InvalidMessage {
  id: string;
  messageId: string;
  transcription: string;
  hasAudio: boolean;
  ticketId: string;
  createdAt: string;
}

const AmaraTranscriptionFixer = () => {
  const [invalidMessages, setInvalidMessages] = useState<InvalidMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string[]>([]);

  const findInvalidMessages = async () => {
    setLoading(true);
    try {
      const messages = await amaraTranscriptionFixer.findInvalidTranscriptions();
      setInvalidMessages(messages);
      
      if (messages.length === 0) {
        toast.success('Nenhuma transcrição inválida encontrada!');
      } else {
        toast.warning(`Encontradas ${messages.length} transcrições inválidas`);
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      toast.error('Erro ao buscar mensagens inválidas');
    } finally {
      setLoading(false);
    }
  };

  const cleanInvalidTranscription = async (messageId: string) => {
    if (processing.includes(messageId)) return;
    
    setProcessing(prev => [...prev, messageId]);
    try {
      await amaraTranscriptionFixer.cleanInvalidTranscriptions([messageId]);
      
      setInvalidMessages(prev => 
        prev.filter(msg => msg.messageId !== messageId)
      );
      
      toast.success('Transcrição inválida removida');
    } catch (error) {
      console.error('Erro ao limpar transcrição:', error);
      toast.error('Erro ao limpar transcrição');
    } finally {
      setProcessing(prev => prev.filter(id => id !== messageId));
    }
  };

  const cleanAllInvalidTranscriptions = async () => {
    if (invalidMessages.length === 0) return;
    
    setLoading(true);
    try {
      const messageIds = invalidMessages.map(msg => msg.messageId);
      await amaraTranscriptionFixer.cleanInvalidTranscriptions(messageIds);
      
      setInvalidMessages([]);
      toast.success(`${messageIds.length} transcrições inválidas removidas`);
    } catch (error) {
      console.error('Erro ao limpar todas as transcrições:', error);
      toast.error('Erro ao limpar transcrições');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Corretor de Transcrições "Amara.org"
        </CardTitle>
        <CardDescription>
          Detecta e corrige transcrições inválidas causadas por áudios corrompidos do WhatsApp
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={findInvalidMessages}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar Transcrições Inválidas'}
          </Button>
          
          {invalidMessages.length > 0 && (
            <Button 
              onClick={cleanAllInvalidTranscriptions}
              disabled={loading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Todas ({invalidMessages.length})
            </Button>
          )}
        </div>

        {invalidMessages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">
                {invalidMessages.length} transcrições inválidas encontradas
              </span>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invalidMessages.map((message) => (
                <div 
                  key={message.messageId}
                  className="flex items-center justify-between p-3 border rounded-lg bg-amber-50 border-amber-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {message.messageId}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 truncate">
                      "{message.transcription}"
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {message.hasAudio ? (
                        <Badge variant="default" className="text-xs">
                          ✓ Áudio disponível
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          ⚠️ Sem áudio
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cleanInvalidTranscription(message.messageId)}
                    disabled={processing.includes(message.messageId)}
                    className="ml-2"
                  >
                    {processing.includes(message.messageId) ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {invalidMessages.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Nenhuma transcrição inválida encontrada</p>
            <p className="text-sm">Clique em "Buscar" para verificar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AmaraTranscriptionFixer;