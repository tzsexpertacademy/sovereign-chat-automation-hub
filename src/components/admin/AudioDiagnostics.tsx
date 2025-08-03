import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AudioLibraryDebugger } from "./AudioLibraryDebugger";
import { AudioTTSDiagnostic } from "./AudioTTSDiagnostic";
import { AudioWhatsAppDiagnostic } from "./AudioWhatsAppDiagnostic";
import { AudioSendingDiagnostic } from "./AudioSendingDiagnostic";
import { AudioRecoveryPanel } from "./AudioRecoveryPanel";
import { Music, MessageSquare, Mic, Send, Wrench } from "lucide-react";

const AudioDiagnostics = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-6 w-6" />
            Diagnóstico Completo de Áudio
          </CardTitle>
          <CardDescription>
            Central de diagnóstico para todos os problemas relacionados a áudio no sistema
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Biblioteca
          </TabsTrigger>
          <TabsTrigger value="tts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            TTS
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="sending" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Envio
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Ferramentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico de Biblioteca de Áudio</CardTitle>
              <CardDescription>
                Testa comandos de biblioteca de áudio e matching inteligente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AudioLibraryDebugger />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tts">
          <AudioTTSDiagnostic />
        </TabsContent>

        <TabsContent value="whatsapp">
          <AudioWhatsAppDiagnostic />
        </TabsContent>

        <TabsContent value="sending">
          <AudioSendingDiagnostic />
        </TabsContent>

        <TabsContent value="tools">
          <AudioRecoveryPanel clientId="" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudioDiagnostics;