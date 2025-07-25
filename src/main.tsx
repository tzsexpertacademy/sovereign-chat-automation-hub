import { createRoot } from 'react-dom/client'
import { InstanceManagerProvider } from './contexts/InstanceManagerContext'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <InstanceManagerProvider>
    <App />
  </InstanceManagerProvider>
);
