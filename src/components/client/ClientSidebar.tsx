
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings, 
  Zap,
  Send,
  Layers,
  Calendar,
  Phone,
  Bot,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface ClientSidebarProps {
  clientId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const ClientSidebar = ({ clientId, activeTab, onTabChange }: ClientSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: null },
    { id: 'instances', label: 'Instâncias', icon: Phone, badge: null },
    { id: 'queues', label: 'Filas', icon: Layers, badge: null },
    { 
      id: 'assistants', 
      label: 'Assistentes IA', 
      icon: Bot, 
      badge: null,
      highlight: true,
      description: 'Configure sua API OpenAI'
    },
    { id: 'contacts', label: 'Contatos', icon: Users, badge: null },
    { id: 'analytics', label: 'Relatórios', icon: BarChart3, badge: null },
    { id: 'automation', label: 'Automação', icon: Zap, badge: null },
    { id: 'campaigns', label: 'Campanhas', icon: Send, badge: null },
    { id: 'funnel', label: 'Funil', icon: Layers, badge: null },
    { id: 'booking', label: 'Agendamentos', icon: Calendar, badge: null },
  ];

  const handleItemClick = (itemId: string) => {
    if (itemId === 'assistants') {
      // Navegar para a página de assistentes
      window.location.href = '/client/assistants';
      return;
    }
    onTabChange?.(itemId);
  };

  return (
    <aside className={`bg-white border-r transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={`w-full justify-start h-auto ${collapsed ? 'px-2' : 'px-3'} ${
                item.highlight ? 'border border-blue-200 bg-blue-50 hover:bg-blue-100' : ''
              }`}
              onClick={() => handleItemClick(item.id)}
            >
              <div className="flex items-center gap-3 w-full">
                <item.icon className={`h-5 w-5 ${item.highlight ? 'text-blue-600' : ''}`} />
                {!collapsed && (
                  <div className="flex-1 text-left">
                    <div className={`font-medium ${item.highlight ? 'text-blue-700' : ''}`}>
                      {item.label}
                      {item.highlight && <Sparkles className="inline h-4 w-4 ml-1 text-blue-500" />}
                    </div>
                    {item.description && !collapsed && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </div>
                    )}
                  </div>
                )}
                {item.badge && !collapsed && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </Button>
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Configuração IA</span>
            </div>
            <p className="text-xs text-blue-600 mb-3">
              Configure sua chave API da OpenAI para ativar os assistentes inteligentes
            </p>
            <Button 
              size="sm" 
              className="w-full" 
              onClick={() => window.location.href = '/client/assistants'}
            >
              <Settings className="h-3 w-3 mr-1" />
              Configurar Agora
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ClientSidebar;
