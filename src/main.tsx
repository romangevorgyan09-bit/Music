import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  // Capture-phase error listener to block "Script error." or cross-origin exceptions immediately
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const url = event.filename || '';
    if (
      msg === 'Script error.' || 
      msg.includes('cross-origin') || 
      (url && (url.includes('youtube.com') || url.includes('ytimg.com') || url.includes('ggpht.com')))
    ) {
      console.log('[Benign Iframe Error Blocked]:', msg, 'Resource:', url);
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  // Capture-phase unhandled rejection listener
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonStr = reason ? String(reason.message || reason) : '';
    if (
      reasonStr === 'Script error.' ||
      reasonStr.includes('cross-origin') ||
      reasonStr.includes('youtube.com') ||
      reasonStr.includes('ytimg.com')
    ) {
      console.log('[Benign Rejection Blocked]:', reasonStr);
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  const originalOnError = window.onerror;
  window.onerror = function (message, url, line, col, error) {
    const msgStr = String(message);
    if (
      msgStr === 'Script error.' || 
      msgStr.includes('cross-origin') || 
      (url && (url.includes('youtube.com') || url.includes('ytimg.com') || url.includes('ggpht.com')))
    ) {
      console.log('[Benign Iframe Error Filtered]:', message, 'Resource:', url);
      return true; // Swallows error reporting to prevent false failure alarms in iframe
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
