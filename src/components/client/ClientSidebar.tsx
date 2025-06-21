
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Bot, 
  BarChart3, 
  Settings, 
  Zap, 
  Calendar,
  Phone,
  Users,
  GitBranch,
  Layers,
  Link
} from 'lucide-react';

interface ClientSidebarProps {
  clientId: string;
}

const ClientSidebar = ({ clientId }: ClientSidebarProps) => {
  const location = useLocation();
  
  const navigation = [
    {
      name: 'Conexão',
      href: `/client/${clientId}/connect`,
      icon: Link,
    },
    {
      name: 'Chat',
      href: `/client/${clientId}/chat`,
      icon: MessageSquare,
    },
    {
      name: 'Funil & Kanban',
      href: `/client/${clientId}/funnel`,
      icon: GitBranch,
    },
    {
      name: 'Assistentes',
      href: `/client/${clientId}/assistants`,
      icon: Bot,
    },
    {
      name: 'Filas',
      href: `/client/${clientId}/queues`,
      icon: Layers,
    },
    {
      name: 'Instâncias',
      href: `/client/${clientId}/instances`,
      icon: Phone,
    },
    {
      name: 'Agendamentos',
      href: `/client/${clientId}/booking`,
      icon: Calendar,
    },
    {
      name: 'Automação',
      href: `/client/${clientId}/automation`,
      icon: Zap,
    },
    {
      name: 'Analytics',
      href: `/client/${clientId}/analytics`,
      icon: BarChart3,
    },
    {
      name: 'Configurações',
      href: `/client/${clientId}/settings`,
      icon: Settings,
    },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Painel do Cliente</h2>
        <p className="text-sm text-gray-500">ID: {clientId}</p>
      </div>
      <nav className="mt-6">
        <div className="px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5',
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ClientSidebar;
