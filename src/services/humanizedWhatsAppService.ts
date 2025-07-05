import { whatsappService } from './whatsappMultiClient';

export interface HumanizedMediaFile {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location';
  url?: string;
  base64?: string;
  filename?: string;
  mimetype?: string;
  caption?: string;
  duration?: number; // for audio/video
  coordinates?: { lat: number; lng: number }; // for location
  contactData?: any; // for contact
}

export interface HumanizedMessage {
  id: string;
  chatId: string;
  instanceId: string;
  type: 'text' | 'media' | 'reaction' | 'typing' | 'recording';
  content?: string;
  media?: HumanizedMediaFile;
  fromMe: boolean;
  timestamp: Date;
  humanizedMetadata?: {
    personality: string;
    emotionalTone: string;
    responseDelay: number;
    confidence: number;
  };
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

class HumanizedWhatsAppService {
  private elevenLabsApiKey?: string;
  private openAiApiKey?: string;

  constructor() {
    console.log('🤖 Humanized WhatsApp Service initialized');
  }

  // Initialize API keys
  setApiKeys(openAi?: string, elevenLabs?: string) {
    this.openAiApiKey = openAi;
    this.elevenLabsApiKey = elevenLabs;
    console.log('🔑 API keys configured:', { 
      openAi: !!openAi, 
      elevenLabs: !!elevenLabs 
    });
  }

  // Send text message with humanization
  async sendHumanizedText(
    clientId: string, 
    chatId: string, 
    text: string,
    personality?: any
  ): Promise<any> {
    try {
      console.log(`📤 Enviando texto humanizado para ${chatId}:`, text.substring(0, 50));
      
      // Apply personality-based modifications
      const humanizedText = this.applyPersonalityToText(text, personality);
      
      return await whatsappService.sendMessage(clientId, chatId, humanizedText);
    } catch (error) {
      console.error('❌ Erro ao enviar texto humanizado:', error);
      throw error;
    }
  }

  // Send image with OCR analysis
  async sendImageWithAnalysis(
    clientId: string,
    chatId: string,
    imageData: HumanizedMediaFile,
    analyzeContent = true
  ): Promise<any> {
    try {
      console.log(`🖼️ Enviando imagem para ${chatId}`);
      
      let analysis = '';
      if (analyzeContent && this.openAiApiKey && imageData.base64) {
        analysis = await this.analyzeImageContent(imageData.base64);
      }
      
      // Send image via existing service
      const result = await this.sendMediaFile(clientId, chatId, imageData);
      
      // Send analysis as follow-up if available
      if (analysis) {
        setTimeout(async () => {
          await this.sendHumanizedText(clientId, chatId, `📸 ${analysis}`);
        }, 2000);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao enviar imagem:', error);
      throw error;
    }
  }

  // Send audio with transcription
  async sendAudioWithTranscription(
    clientId: string,
    chatId: string,
    audioData: HumanizedMediaFile
  ): Promise<any> {
    try {
      console.log(`🎤 Enviando áudio para ${chatId}`);
      
      // Send audio file
      const result = await this.sendMediaFile(clientId, chatId, audioData);
      
      // Transcribe if OpenAI available
      if (this.openAiApiKey && audioData.base64) {
        setTimeout(async () => {
          try {
            const transcription = await this.transcribeAudio(audioData.base64);
            if (transcription.text) {
              await this.sendHumanizedText(
                clientId, 
                chatId, 
                `🎵 *Transcrição:* ${transcription.text}`
              );
            }
          } catch (error) {
            console.error('❌ Erro na transcrição:', error);
          }
        }, 3000);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
      throw error;
    }
  }

  // Generate and send voice message
  async sendVoiceMessage(
    clientId: string,
    chatId: string,
    text: string,
    voiceId?: string
  ): Promise<any> {
    try {
      if (!this.elevenLabsApiKey) {
        throw new Error('ElevenLabs API key not configured');
      }
      
      console.log(`🗣️ Gerando áudio para: "${text.substring(0, 50)}..."`);
      
      const audioBase64 = await this.textToSpeech(text, voiceId);
      
      const audioData: HumanizedMediaFile = {
        type: 'audio',
        base64: audioBase64,
        mimetype: 'audio/mpeg',
        filename: `voice_${Date.now()}.mp3`
      };
      
      return await this.sendMediaFile(clientId, chatId, audioData);
    } catch (error) {
      console.error('❌ Erro ao enviar áudio gerado:', error);
      throw error;
    }
  }

  // Send document with summary
  async sendDocumentWithSummary(
    clientId: string,
    chatId: string,
    documentData: HumanizedMediaFile,
    generateSummary = true
  ): Promise<any> {
    try {
      console.log(`📄 Enviando documento para ${chatId}:`, documentData.filename);
      
      const result = await this.sendMediaFile(clientId, chatId, documentData);
      
      // Generate summary for text documents
      if (generateSummary && this.openAiApiKey && this.isTextDocument(documentData)) {
        setTimeout(async () => {
          try {
            const summary = await this.generateDocumentSummary(documentData);
            if (summary) {
              await this.sendHumanizedText(
                clientId,
                chatId,
                `📋 *Resumo do documento:*\n${summary}`
              );
            }
          } catch (error) {
            console.error('❌ Erro ao gerar resumo:', error);
          }
        }, 4000);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao enviar documento:', error);
      throw error;
    }
  }

  // Send sticker with context
  async sendContextualSticker(
    clientId: string,
    chatId: string,
    emotion: string
  ): Promise<any> {
    try {
      // Map emotions to sticker URLs (placeholder implementation)
      const stickerMap = {
        happy: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABBxJJJkAA/Q9ERP8DAAA=',
        sad: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABBxJJJkAA/Q9ERP8DAAA=',
        angry: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABBxJJJkAA/Q9ERP8DAAA=',
        surprised: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABBxJJJkAA/Q9ERP8DAAA=',
        love: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABBxJJJkAA/Q9ERP8DAAA='
      };
      
      const stickerData: HumanizedMediaFile = {
        type: 'sticker',
        base64: stickerMap[emotion] || stickerMap.happy,
        mimetype: 'image/webp'
      };
      
      return await this.sendMediaFile(clientId, chatId, stickerData);
    } catch (error) {
      console.error('❌ Erro ao enviar sticker:', error);
      throw error;
    }
  }

  // Send location
  async sendLocation(
    clientId: string,
    chatId: string,
    coordinates: { lat: number; lng: number },
    title?: string
  ): Promise<any> {
    try {
      console.log(`📍 Enviando localização para ${chatId}:`, coordinates);
      
      const locationData: HumanizedMediaFile = {
        type: 'location',
        coordinates,
        caption: title
      };
      
      return await this.sendMediaFile(clientId, chatId, locationData);
    } catch (error) {
      console.error('❌ Erro ao enviar localização:', error);
      throw error;
    }
  }

  // Send contact
  async sendContact(
    clientId: string,
    chatId: string,
    contactData: any
  ): Promise<any> {
    try {
      console.log(`👤 Enviando contato para ${chatId}:`, contactData.name);
      
      const contact: HumanizedMediaFile = {
        type: 'contact',
        contactData
      };
      
      return await this.sendMediaFile(clientId, chatId, contact);
    } catch (error) {
      console.error('❌ Erro ao enviar contato:', error);
      throw error;
    }
  }

  // Private helper methods
  private async sendMediaFile(
    clientId: string,
    chatId: string,
    mediaData: HumanizedMediaFile
  ): Promise<any> {
    // Placeholder implementation - would integrate with whatsapp-web.js
    console.log(`📎 Sending ${mediaData.type} to ${chatId}`);
    
    // This should integrate with the actual WhatsApp media sending API
    return { success: true, messageId: `msg_${Date.now()}` };
  }

  private applyPersonalityToText(text: string, personality?: any): string {
    if (!personality) return text;
    
    let modifiedText = text;
    
    // Add emojis based on personality
    if (personality.emotionalLevel > 0.5) {
      if (text.includes('obrigad')) modifiedText += ' 😊';
      if (text.includes('oi') || text.includes('olá')) modifiedText += ' 👋';
      if (text.includes('?')) modifiedText = modifiedText.replace('?', '? 🤔');
    }
    
    // Adjust tone
    if (personality.tone === 'casual') {
      modifiedText = modifiedText.replace(/Você/g, 'Vc');
      modifiedText = modifiedText.replace(/Por favor/g, 'Por favor');
    }
    
    return modifiedText;
  }

  private async analyzeImageContent(base64Image: string): Promise<string> {
    if (!this.openAiApiKey) return '';
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analise esta imagem brevemente em português brasileiro (máximo 100 caracteres):'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 100
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('❌ Erro na análise de imagem:', error);
    }
    
    return '';
  }

  private async transcribeAudio(base64Audio: string): Promise<TranscriptionResult> {
    if (!this.openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      // Convert base64 to blob
      const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAiApiKey}`,
        },
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          text: data.text,
          confidence: 1.0,
          language: 'pt-BR',
          duration: 0
        };
      }
    } catch (error) {
      console.error('❌ Erro na transcrição:', error);
    }
    
    return { text: '', confidence: 0, language: 'pt-BR', duration: 0 };
  }

  private async textToSpeech(text: string, voiceId?: string): Promise<string> {
    if (!this.elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'pNInz6obpgDQGcFmaJgB'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.elevenLabsApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        }),
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        return btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      }
    } catch (error) {
      console.error('❌ Erro no text-to-speech:', error);
    }
    
    throw new Error('Failed to generate speech');
  }

  private async generateDocumentSummary(documentData: HumanizedMediaFile): Promise<string> {
    // Placeholder - would extract text from document and summarize
    return `Documento: ${documentData.filename} - Resumo não disponível`;
  }

  private isTextDocument(documentData: HumanizedMediaFile): boolean {
    const textMimeTypes = ['text/plain', 'application/pdf', 'application/msword'];
    return textMimeTypes.some(type => documentData.mimetype?.includes(type));
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

export const humanizedWhatsAppService = new HumanizedWhatsAppService();
export default humanizedWhatsAppService;