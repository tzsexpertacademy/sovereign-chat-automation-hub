import React from 'react';
import { Loader2, Mic, Bot, Eye, CheckCheck, Clock, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SmartTypingIndicatorProps {
  isTyping?: boolean;
  isRecording?: boolean;
  isOnline?: boolean;
  userName?: string;
  userAvatar?: string;
  showOnlineStatus?: boolean;
  isAI?: boolean;
  estimatedTime?: number;
  messageType?: 'text' | 'audio' | 'image' | 'document';
  stage?: 'reading' | 'thinking' | 'typing' | 'recording' | 'finishing' | 'ready';
  progress?: number;
}

const SmartTypingIndicator: React.FC<SmartTypingIndicatorProps> = ({
  isTyping = false,
  isRecording = false,
  isOnline = false,
  userName = "Assistente",
  userAvatar,
  showOnlineStatus = true,
  isAI = false,
  estimatedTime,
  messageType = 'text',
  stage = 'thinking',
  progress = 0
}) => {
  // Se não há atividade, não mostrar nada
  if (!isTyping && !isRecording && (!showOnlineStatus || !isOnline)) {
    return null;
  }

  const getStageInfo = () => {
    switch (stage) {
      case 'reading':
        return {
          icon: <Eye className="w-4 h-4" />,
          text: 'Lendo mensagem...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        };
      case 'thinking':
        return {
          icon: <Bot className="w-4 h-4" />,
          text: 'Processando...',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        };
      case 'typing':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: `Digitando ${messageType === 'text' ? 'resposta' : 'mensagem'}...`,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        };
      case 'recording':
        return {
          icon: <Mic className="w-4 h-4 animate-pulse" />,
          text: 'Gravando áudio...',
          color: 'text-red-600',
          bgColor: 'bg-red-50'
        };
      case 'finishing':
        return {
          icon: <Clock className="w-4 h-4" />,
          text: 'Finalizando...',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      case 'ready':
        return {
          icon: <CheckCheck className="w-4 h-4" />,
          text: 'Pronto!',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      default:
        return {
          icon: <Bot className="w-4 h-4" />,
          text: 'Ativo...',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className="border-t bg-gradient-to-r from-background to-muted/30 backdrop-blur-sm">
      <div className="px-4 py-3">
        <div className="flex items-center space-x-3">
          {/* Avatar do usuário */}
          {userAvatar ? (
            <img 
              src={userAvatar} 
              alt={userName}
              className="w-6 h-6 rounded-full border border-border"
            />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${stageInfo.bgColor} ${stageInfo.color}`}>
              {isAI ? <Bot className="w-3 h-3" /> : <div className="w-2 h-2 bg-current rounded-full" />}
            </div>
          )}

          {/* Informações do status */}
          <div className="flex items-center space-x-3 flex-1">
            {/* Status principal */}
            <div className="flex items-center space-x-2">
              <div className={stageInfo.color}>
                {stageInfo.icon}
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${stageInfo.color}`}>
                    {isAI ? '🤖 IA' : userName}
                  </span>
                  
                  {isOnline && (
                    <div className="flex items-center space-x-1">
                      <Wifi className="w-3 h-3 text-green-500" />
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                
                <span className={`text-xs ${stageInfo.color}`}>
                  {stageInfo.text}
                </span>
              </div>
            </div>

            {/* Badges de contexto */}
            <div className="flex items-center space-x-2">
              {messageType !== 'text' && (
                <Badge variant="outline" className="text-xs">
                  {messageType === 'audio' && '🎤 Áudio'}
                  {messageType === 'image' && '🖼️ Imagem'}
                  {messageType === 'document' && '📄 Documento'}
                </Badge>
              )}
              
              {isAI && (
                <Badge variant="outline" className="text-xs">
                  IA Inteligente
                </Badge>
              )}
            </div>

            {/* Tempo estimado */}
            {estimatedTime && estimatedTime > 0 && (
              <div className="text-xs text-muted-foreground">
                ~{Math.ceil(estimatedTime / 1000)}s
              </div>
            )}
          </div>

          {/* Animações visuais */}
          <div className="flex items-center space-x-1">
            {isTyping && (
              <div className="flex space-x-1">
                <div className={`w-2 h-2 rounded-full animate-bounce ${stageInfo.color.replace('text-', 'bg-')}`} 
                     style={{ animationDelay: '0ms' }} />
                <div className={`w-2 h-2 rounded-full animate-bounce ${stageInfo.color.replace('text-', 'bg-')}`} 
                     style={{ animationDelay: '150ms' }} />
                <div className={`w-2 h-2 rounded-full animate-bounce ${stageInfo.color.replace('text-', 'bg-')}`} 
                     style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {isRecording && (
              <div className="flex space-x-1">
                <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
                <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
                <div className="w-1 h-5 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        {progress > 0 && progress < 100 && (
          <div className="mt-2">
            <div className="w-full bg-muted rounded-full h-1">
              <div 
                className={`h-1 rounded-full transition-all duration-300 ${stageInfo.color.replace('text-', 'bg-')}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Detalhes adicionais para IA */}
        {isAI && stage === 'thinking' && (
          <div className="mt-2">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Bot className="w-3 h-3" />
              <span>Analisando contexto e gerando resposta inteligente</span>
            </div>
          </div>
        )}

        {isAI && stage === 'recording' && (
          <div className="mt-2">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Mic className="w-3 h-3" />
              <span>Processando áudio com síntese de voz natural</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartTypingIndicator;