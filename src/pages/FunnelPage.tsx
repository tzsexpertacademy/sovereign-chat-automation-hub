
import React from 'react';
import { useParams } from 'react-router-dom';
import FunnelKanban from '@/components/client/FunnelKanban';
import ClientHeader from '@/components/client/ClientHeader';

const FunnelPage = () => {
  const { clientId } = useParams<{ clientId: string }>();

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientHeader clientId={clientId} />
      <div className="flex">
        <main className="flex-1 p-6">
          <FunnelKanban clientId={clientId} />
        </main>
      </div>
    </div>
  );
};

export default FunnelPage;
