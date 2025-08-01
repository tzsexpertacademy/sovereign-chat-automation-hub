import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, FileImage, FileVideo, FileAudio, RotateCcw, ExternalLink } from 'lucide-react';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { supabase } from '@/integrations/supabase/client';

interface DocumentViewerProps {
  documentUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  needsDecryption?: boolean;
  caption?: string;
  fileName?: string;
  fileType?: string;
  instanceId?: string;
  chatId?: string;
  message?: any; // Objeto da mensagem completo para acessar document_base64
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  messageId,
  mediaKey,
  fileEncSha256,
  directPath,
  needsDecryption = false,
  caption,
  fileName = 'document',
  fileType,
  instanceId,
  chatId,
  message
}) => {
  const [displayDocumentUrl, setDisplayDocumentUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const processDocument = async () => {
      if (!documentUrl && !messageId) {
        setError('Documento não disponível');
        return;
      }

      setIsProcessing(true);
      setError('');

      console.log('📄 DocumentViewer: Processando documento:', {
        hasDocumentUrl: !!documentUrl,
        hasMessageId: !!messageId,
        hasMediaKey: !!mediaKey,
        needsDecryption,
        fileType
      });

      try {
        // PRIORIDADE 1: Se há document_base64 na prop message, usar ele SEMPRE
        if (message?.document_base64) {
          console.log('✅ DocumentViewer: Usando document_base64 da prop message');
          const mimeType = fileType || message.media_mime_type || 'application/octet-stream';
          const dataUrl = `data:${mimeType};base64,${message.document_base64}`;
          setDisplayDocumentUrl(dataUrl);
          setIsProcessing(false);
          return;
        }

        // PRIORIDADE 2: Para mensagens manuais sem base64, mostrar erro específico
        const isManualMessage = messageId?.startsWith('manual_');
        if (isManualMessage) {
          console.log('❌ DocumentViewer: Mensagem manual sem document_base64 salvo');
          setError('Documento manual não disponível - base64 não foi salvo corretamente');
          return;
        }

        // PRIORIDADE 3: Mensagens recebidas com mediaKey -> servidor descriptografa
        if (documentUrl && mediaKey) {
          console.log('📡 DocumentViewer: Obtendo documento descriptografado do servidor');
          
          const currentUrl = window.location.pathname;
          const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
          const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
          
          if (ticketId) {
            const { data: ticketData } = await supabase
              .from('conversation_tickets')
              .select('instance_id')
              .eq('id', ticketId)
              .single();
            
            if (ticketData?.instance_id) {
              const result = await directMediaDownloadService.processMedia(
                ticketData.instance_id,
                messageId || `doc_${Date.now()}`,
                documentUrl,
                mediaKey,
                directPath,
                fileType || 'application/octet-stream',
                'document'
              );

              if (result.success && result.mediaUrl) {
                console.log('✅ DocumentViewer: Documento pronto para exibição');
                setDisplayDocumentUrl(result.mediaUrl);
                return;
              }
              
              console.log('❌ DocumentViewer: Falha ao obter documento do servidor');
            }
          }
        }

        // FALLBACK FINAL: URL original
        if (documentUrl) {
          console.log('🔄 DocumentViewer: Fallback final - URL original');
          setDisplayDocumentUrl(documentUrl);
          return;
        }

        // Falha total
        setError('Documento não disponível');

      } catch (error) {
        console.error('❌ DocumentViewer: Erro no processamento:', error);
        setError('Erro ao carregar documento');
        
        // Último fallback
        if (documentUrl) {
          setDisplayDocumentUrl(documentUrl);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    processDocument();
  }, [documentUrl, messageId, mediaKey, directPath, fileType, needsDecryption, instanceId, chatId]);

  const getFileIcon = (fileName: string, fileType?: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const type = fileType?.toLowerCase();

    if (type?.includes('pdf') || extension === 'pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (type?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <FileImage className="w-8 h-8 text-green-500" />;
    }
    if (type?.includes('video') || ['mp4', 'avi', 'mov', 'webm'].includes(extension || '')) {
      return <FileVideo className="w-8 h-8 text-blue-500" />;
    }
    if (type?.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) {
      return <FileAudio className="w-8 h-8 text-purple-500" />;
    }
    
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const canPreview = (fileName: string, fileType?: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const type = fileType?.toLowerCase();
    
    return type?.includes('pdf') || extension === 'pdf';
  };

  const handleDownload = () => {
    if (displayDocumentUrl) {
      const link = document.createElement('a');
      link.href = displayDocumentUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = () => {
    if (displayDocumentUrl && canPreview(fileName, fileType)) {
      setShowPreview(true);
    }
  };

  const formatFileSize = (url: string) => {
    // Não temos o tamanho do arquivo, mas podemos tentar estimar ou mostrar isso de forma genérica
    return 'Tamanho desconhecido';
  };

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Processando documento...</span>
        </div>
      </div>
    );
  }

  if (error && !displayDocumentUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-center">
          <p className="font-medium">Erro ao carregar documento</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      {/* Preview Modal para PDFs */}
      {showPreview && displayDocumentUrl && canPreview(fileName, fileType) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold truncate">{fileName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                ✕
              </Button>
            </div>
            <iframe
              src={displayDocumentUrl}
              className="w-full h-[70vh] border rounded"
              title={fileName}
              onError={(e) => {
                console.error('❌ DocumentViewer: Erro no iframe:', e);
                setError('Erro ao exibir PDF');
              }}
            />
          </div>
        </div>
      )}

      {/* Documento Card */}
      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <div className="flex items-start gap-3">
          {/* Ícone do arquivo */}
          <div className="flex-shrink-0">
            {getFileIcon(fileName, fileType)}
          </div>
          
          {/* Informações do arquivo */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {fileName}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              {formatFileSize(displayDocumentUrl || '')}
            </p>
            
            {/* Caption */}
            {caption && caption !== '📄 Documento' && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                {caption}
              </p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!displayDocumentUrl}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          {canPreview(fileName, fileType) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={!displayDocumentUrl}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Visualizar
            </Button>
          )}
        </div>
      </div>

      {/* Informações de debug (somente em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          <div>Processamento: {needsDecryption ? 'API nativa' : 'URL direta'}</div>
          <div>Tipo: {fileType || 'Desconhecido'}</div>
          {messageId && <div>ID: {messageId}</div>}
          {instanceId && <div>Instance: {instanceId}</div>}
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;