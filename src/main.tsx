import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import { App } from './App';
import { AppSettingsProvider } from '@/context/appSettings';
import { initRevenueCat } from '@/lib/revenueCat';
import { initAdMob } from '@/lib/ads';

// Fire-and-forget — app renders regardless of SDK availability
initRevenueCat().catch(() => {});
initAdMob().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
