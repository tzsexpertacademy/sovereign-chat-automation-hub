import { createRoot } from 'react-dom/client'
import { InstanceManagerProvider } from './contexts/InstanceManagerContext'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.tsx'
import './index.css'

console.log('🔍 [Main] Iniciando aplicação...');

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <InstanceManagerProvider>
      <App />
    </InstanceManagerProvider>
  </ErrorBoundary>
);
