
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getServerConfig } from "@/config/environment";

interface ConnectionStatusProps {
  className?: string;
  connectedInstance?: string;
  isOnline?: boolean;
}

const ConnectionStatus = ({ className, connectedInstance, isOnline: propIsOnline }: ConnectionStatusProps) => {
  const [isServerOnline, setIsServerOnline] = useState(true);
  const config = getServerConfig();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${config.SERVER_URL}/health`, {
          method: 'GET',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        setIsServerOnline(true);
      } catch (error) {
        setIsServerOnline(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [config.SERVER_URL]);

  // Use prop isOnline if provided, otherwise use server check
  const isOnline = propIsOnline !== undefined ? propIsOnline : isServerOnline;
  
  // Show instance info if available
  const statusText = connectedInstance 
    ? `${isOnline ? "🟢" : "🔴"} ${connectedInstance}`
    : `${isOnline ? "🟢 Online" : "🔴 Offline"}`;

  return (
    <Badge 
      variant={isOnline ? "default" : "destructive"}
      className={className}
    >
      {statusText}
    </Badge>
  );
};

export default ConnectionStatus;
