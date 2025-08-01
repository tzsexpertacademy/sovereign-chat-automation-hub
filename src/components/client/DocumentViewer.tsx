import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, FileImage, FileVideo, FileAudio, RotateCcw, ExternalLink } from 'lucide-react';
import { useUnifiedMedia } from '@/hooks/useUnifiedMedia';

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
  const [showPreview, setShowPreview] = useState(false);

  // Hook unificado para gerenciar mídia
  const { displayUrl, isLoading, error, isFromCache, retry, hasRetried } = useUnifiedMedia({
    messageId: messageId || `doc_${Date.now()}`,
    mediaUrl: documentUrl,
    mediaKey,
    fileEncSha256,
    directPath,
    mimetype: fileType || 'application/pdf',
    contentType: 'document',
    documentBase64: message?.document_base64
  });

  // Usar displayUrl do hook unificado

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

  const handleDownload = async () => {
    if (!displayUrl) return;
    
    try {
      // Garantir que o arquivo tenha a extensão correta
      let downloadFileName = fileName || 'document';
      const extension = fileName?.split('.').pop()?.toLowerCase();
      const type = fileType?.toLowerCase();
      
      // Se é PDF mas não tem extensão .pdf, adicionar
      if ((type?.includes('pdf') || extension === 'pdf') && !downloadFileName.endsWith('.pdf')) {
        downloadFileName = downloadFileName.replace(/\.[^.]*$/, '') + '.pdf';
      }
      // Se não tem extensão e não sabemos o tipo, usar .pdf como padrão para documentos
      else if (!downloadFileName.includes('.') && !type) {
        downloadFileName += '.pdf';
      }
      
      // Se for blob URL, fazer nova requisição para garantir download
      if (displayUrl.startsWith('blob:')) {
        const response = await fetch(displayUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpar URL temporária
        window.URL.revokeObjectURL(url);
      } else {
        // Para URLs regulares
        const link = document.createElement('a');
        link.href = displayUrl;
        link.download = downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      console.log('✅ DocumentViewer: Download iniciado com sucesso:', downloadFileName);
    } catch (error) {
      console.error('❌ DocumentViewer: Erro no download:', error);
    }
  };

  const handlePreview = () => {
    if (displayUrl && canPreview(fileName, fileType)) {
      setShowPreview(true);
    }
  };

  const formatFileSize = (url: string) => {
    // Não temos o tamanho do arquivo, mas podemos tentar estimar ou mostrar isso de forma genérica
    return 'Tamanho desconhecido';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Carregando documento...</span>
        </div>
      </div>
    );
  }

  if (error && !displayUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-center">
          <p className="font-medium">Erro ao carregar documento</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        {!hasRetried && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={retry}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      {/* Preview Modal para PDFs */}
      {showPreview && displayUrl && canPreview(fileName, fileType) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold truncate">{fileName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                ✕
              </Button>
            </div>
            <iframe
              src={displayUrl}
              className="w-full h-[70vh] border rounded"
              title={fileName}
              onError={(e) => {
                console.error('❌ DocumentViewer: Erro no iframe:', e);
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
              {formatFileSize(displayUrl || '')}
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
            disabled={!displayUrl}
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
              disabled={!displayUrl}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Visualizar
            </Button>
          )}
        </div>
      </div>

    </div>
  );
};

export default DocumentViewer;