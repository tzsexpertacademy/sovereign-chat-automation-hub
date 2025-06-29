
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getServerConfig } from "@/config/environment";

interface ConnectionStatusProps {
  className?: string;
}

const ConnectionStatus = ({ className }: ConnectionStatusProps) => {
  const [isOnline, setIsOnline] = useState(true);
  const config = getServerConfig();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${config.SERVER_URL}/health`, {
          method: 'GET',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [config.SERVER_URL]);

  return (
    <Badge 
      variant={isOnline ? "default" : "destructive"}
      className={className}
    >
      {isOnline ? "🟢 Online" : "🔴 Offline"}
    </Badge>
  );
};

export default ConnectionStatus;
