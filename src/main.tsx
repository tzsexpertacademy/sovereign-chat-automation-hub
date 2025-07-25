import { createRoot } from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.tsx'
import './index.css'

console.log('🔍 [Main] Iniciando aplicação...');

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
