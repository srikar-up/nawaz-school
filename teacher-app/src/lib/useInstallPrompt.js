import { useEffect, useState } from 'react';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installed = () => setDeferredPrompt(null);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return result.outcome === 'accepted';
  };

  return { canInstall: Boolean(deferredPrompt), install };
}
