import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Paperclip, Image, Video, FileText, Music } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

interface MediaUploadButtonProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document') => void;
  disabled?: boolean;
  className?: string;
}

const MediaUploadButton = ({ onFileSelect, disabled, className }: MediaUploadButtonProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho
    const maxSizes = {
      image: 25 * 1024 * 1024, // 25MB
      video: 64 * 1024 * 1024, // 64MB
      audio: 25 * 1024 * 1024, // 25MB
      document: 100 * 1024 * 1024 // 100MB
    };

    if (file.size > maxSizes[type]) {
      toast({
        title: "Arquivo muito grande",
        description: `Tamanho máximo para ${type}: ${maxSizes[type] / (1024 * 1024)}MB`,
        variant: "destructive"
      });
      return;
    }

    onFileSelect(file, type);
    event.target.value = ''; // Reset input
  };

  const triggerFileInput = (inputRef: React.RefObject<HTMLInputElement>) => {
    inputRef.current?.click();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            disabled={disabled}
            className={`h-10 w-10 ${className}`}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => triggerFileInput(imageInputRef)}>
            <Image className="mr-2 h-4 w-4" />
            Imagem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(videoInputRef)}>
            <Video className="mr-2 h-4 w-4" />
            Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(audioInputRef)}>
            <Music className="mr-2 h-4 w-4" />
            Áudio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(documentInputRef)}>
            <FileText className="mr-2 h-4 w-4" />
            Documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileChange(e, 'image')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleFileChange(e, 'video')}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleFileChange(e, 'audio')}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
        onChange={(e) => handleFileChange(e, 'document')}
        className="hidden"
      />
    </>
  );
};

export default MediaUploadButton;