
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User, Bell, Settings, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import ChatInterfaceImproved from './ChatInterfaceImproved';
import ContactsManager from './ContactsManager';
import { realTimeNotificationService } from '@/services/realTimeNotificationService';

interface ChatTabsInterfaceProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatTabsInterface = ({ clientId, selectedChatId, onSelectChat }: ChatTabsInterfaceProps) => {
  const [activeTab, setActiveTab] = useState("conversations");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Verificar se deve abrir aba de conversas automaticamente
  useEffect(() => {
    const openConversation = searchParams.get('openConversation');
    if (openConversation === 'true') {
      setActiveTab('conversations');
      // Remover o parâmetro da URL após usar
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openConversation');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Inicializar notificações quando componente monta
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await realTimeNotificationService.initialize(clientId);
        setConnectionStatus('online');
        
        toast({
          title: "🔔 Notificações Ativadas",
          description: "Sistema de notificações em tempo real conectado",
          duration: 3000
        });
      } catch (error) {
        console.error('Erro ao inicializar notificações:', error);
        setConnectionStatus('offline');
        
        toast({
          title: "⚠️ Notificações Indisponíveis",
          description: "Falha ao conectar sistema de notificações",
          variant: "destructive",
          duration: 5000
        });
      }
    };

    initializeNotifications();

    // Cleanup ao desmontar
    return () => {
      realTimeNotificationService.cleanup();
    };
  }, [clientId, toast]);

  // Simular contagem de não lidas (será conectado ao real time depois)
  useEffect(() => {
    const interval = setInterval(() => {
      // Aqui seria conectado ao Supabase Realtime para contar mensagens não lidas
      // Por enquanto, simula uma contagem
      if (activeTab !== 'conversations') {
        setUnreadCount(prev => Math.max(0, prev + Math.floor(Math.random() * 2)));
      } else {
        setUnreadCount(0);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const toggleNotifications = () => {
    setIsNotificationsEnabled(!isNotificationsEnabled);
    
    if (!isNotificationsEnabled) {
      realTimeNotificationService.testNotification();
      toast({
        title: "🔔 Notificações Ativadas",
        description: "Você receberá alertas para novos tickets e mensagens"
      });
    } else {
      toast({
        title: "🔕 Notificações Desativadas",
        description: "Notificações pausadas temporariamente"
      });
    }
  };

  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case 'online':
        return {
          icon: <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />,
          text: 'Online',
          color: 'text-green-600'
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Offline',
          color: 'text-red-600'
        };
      case 'connecting':
        return {
          icon: <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />,
          text: 'Conectando',
          color: 'text-yellow-600'
        };
    }
  };

  const statusInfo = getConnectionStatusInfo();

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header melhorado com status e controles */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-background to-muted/30">
        <div className="flex items-center space-x-3">
          <h2 className="font-semibold text-foreground">Comunicação</h2>
          
          {/* Status de conexão */}
          <div className={`flex items-center space-x-1 text-xs ${statusInfo.color}`}>
            {statusInfo.icon}
            <span>{statusInfo.text}</span>
          </div>
        </div>

        {/* Controles de notificação */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleNotifications}
            className={`${isNotificationsEnabled ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Bell className={`w-4 h-4 ${isNotificationsEnabled ? '' : 'opacity-50'}`} />
          </Button>
          
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs modernizadas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
          <TabsTrigger value="conversations" className="flex items-center gap-2 relative">
            <MessageSquare className="w-4 h-4" />
            <span>Conversas</span>
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>Contatos</span>
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 m-4 mt-2">
          <TabsContent value="conversations" className="h-full mt-0">
            <div className="bg-card rounded-lg border h-full overflow-hidden">
            <ChatInterfaceImproved 
              clientId={clientId}
              selectedChatId={selectedChatId}
              onSelectChat={onSelectChat}
            />
            </div>
          </TabsContent>
          
          <TabsContent value="contacts" className="h-full mt-0">
            <div className="bg-card rounded-lg border h-full overflow-hidden">
              <ContactsManager clientId={clientId} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ChatTabsInterface;
