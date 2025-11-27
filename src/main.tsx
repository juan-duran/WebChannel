import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UserProvider } from './state/UserContext.tsx';
import { OnboardingStatusProvider } from './state/OnboardingStatusContext.tsx';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.error('Service Worker registration failed:', error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <OnboardingStatusProvider>
        <App />
      </OnboardingStatusProvider>
    </UserProvider>
  </StrictMode>,
);
