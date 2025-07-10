import React from 'react';
import { Button } from "@/components/ui/button";
import { X, FileText, Music, Image as ImageIcon, Video, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MediaPreviewProps {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  onCancel: () => void;
  onSend: () => void;
  isUploading?: boolean;
}

const MediaPreview = ({ file, type, onCancel, onSend, isUploading }: MediaPreviewProps) => {
  const fileUrl = URL.createObjectURL(file);
  const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(1);

  const renderPreview = () => {
    switch (type) {
      case 'image':
        return (
          <div className="relative">
            <img 
              src={fileUrl} 
              alt="Preview" 
              className="max-w-full max-h-48 rounded-lg object-cover"
            />
          </div>
        );

      case 'video':
        return (
          <div className="relative">
            <video 
              src={fileUrl} 
              controls 
              className="max-w-full max-h-48 rounded-lg"
            />
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <Music className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <audio src={fileUrl} controls className="w-full" />
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <FileText className="w-8 h-8 text-gray-600" />
            <div className="flex-1">
              <p className="font-medium text-sm truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{fileSizeInMB} MB</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            <span className="text-sm font-medium capitalize">{type}</span>
            <span className="text-xs text-gray-500">({fileSizeInMB} MB)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isUploading}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {renderPreview()}

        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onSend}
            disabled={isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isUploading ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MediaPreview;