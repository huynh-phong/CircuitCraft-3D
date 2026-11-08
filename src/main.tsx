import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/context';
import { installApiAuthFetch } from './persistence/apiAuthFetch';
import { initDeviceProfile } from './hooks/useDeviceProfile';
import './index.css';
import { AppErrorBoundary, installStaleChunkRecovery } from './appRecovery';

installStaleChunkRecovery();
installApiAuthFetch();
initDeviceProfile();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <I18nProvider>
          <App />
        </I18nProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

