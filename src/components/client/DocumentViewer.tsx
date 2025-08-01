import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, FileImage, FileVideo, FileAudio, RotateCcw, ExternalLink } from 'lucide-react';
import { mediaDisplayService } from '@/services/mediaDisplayService';

interface DocumentViewerProps {
  documentUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  needsDecryption?: boolean;
  caption?: string;
  fileName?: string;
  fileType?: string;
  instanceId?: string;
  chatId?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  messageId,
  mediaKey,
  fileEncSha256,
  needsDecryption = false,
  caption,
  fileName = 'document',
  fileType,
  instanceId,
  chatId
}) => {
  const [displayDocumentUrl, setDisplayDocumentUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const initializeDocument = async () => {
      if (!documentUrl && !messageId) {
        setError('URL do documento não disponível');
        return;
      }

      // Se tem URL direta e não precisa descriptografar, usar diretamente
      if (documentUrl && !needsDecryption) {
        console.log('📄 DocumentViewer: Usando URL direta');
        setDisplayDocumentUrl(documentUrl);
        return;
      }

      // Usar MediaDisplayService para download via API nativa
      if (messageId && instanceId && chatId) {
        console.log('🔄 DocumentViewer: Processando via MediaDisplayService');
        setIsProcessing(true);
        setError('');

        try {
          const result = await mediaDisplayService.displayMedia({
            instanceId,
            messageId,
            chatId,
            mediaUrl: documentUrl || '',
            mediaKey: mediaKey || '',
            directPath: '',
            mimetype: fileType || 'application/octet-stream',
            contentType: 'document'
          });

          if (result.success && result.mediaUrl) {
            console.log('✅ DocumentViewer: Documento processado com sucesso via', result.strategy);
            setDisplayDocumentUrl(result.mediaUrl);
          } else {
            console.log('❌ DocumentViewer: Falha no processamento:', result.error);
            setError(result.error || 'Falha ao processar documento');
            // Fallback para URL original se disponível
            if (documentUrl) {
              setDisplayDocumentUrl(documentUrl);
            }
          }
        } catch (err) {
          console.error('❌ DocumentViewer: Erro no processamento:', err);
          setError('Erro ao carregar documento');
          // Fallback para URL original se disponível
          if (documentUrl) {
            setDisplayDocumentUrl(documentUrl);
          }
        } finally {
          setIsProcessing(false);
        }
      } else {
        console.log('❌ DocumentViewer: Dados insuficientes para processamento');
        if (documentUrl) {
          setDisplayDocumentUrl(documentUrl);
        } else {
          setError('Dados insuficientes para carregar documento');
        }
      }
    };

    initializeDocument();
  }, [documentUrl, messageId, mediaKey, fileEncSha256, needsDecryption, instanceId, chatId]);

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