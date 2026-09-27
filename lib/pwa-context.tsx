'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAContextType {
  isSupported: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  updateAvailable: boolean;
  isWakeLockActive: boolean;
  notificationPermission: NotificationPermission;
  promptInstall: () => Promise<boolean>;
  applyUpdate: () => void;
  toggleWakeLock: () => Promise<void>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

const PWAContext = createContext<PWAContextType>({
  isSupported: false,
  isOnline: true,
  isStandalone: false,
  isInstallable: false,
  isIOS: false,
  updateAvailable: false,
  isWakeLockActive: false,
  notificationPermission: 'default',
  promptInstall: async () => false,
  applyUpdate: () => {},
  toggleWakeLock: async () => {},
  requestNotificationPermission: async () => 'default',
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsSupported('serviceWorker' in navigator);
    setIsOnline(navigator.onLine);

    // On localhost, actively purge stale v1 SW caches to avoid serving stale HTML
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.includes('v1') || key.includes('traffic-static-v1')) {
              caches.delete(key);
            }
          });
        });
      }
    }

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // Standalone / Display Mode Detection
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    // Notification Permission Check
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // 2. Online / Offline Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. BeforeInstallPrompt Listener (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. App Installed Listener
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('[PWA] App was successfully installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Service Worker Registration & Update Flow
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);

          // Check if there's an active waiting worker on registration
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setUpdateAvailable(true);
          }

          // Listen for new service worker installation
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New update is ready and waiting
                  setWaitingWorker(installingWorker);
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });

      // Reload page when the new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Prompt Install
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Error during promptInstall:', err);
      return false;
    }
  }, [deferredPrompt]);

  // Apply SW Update
  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  // Toggle Screen WakeLock
  const toggleWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      alert('Screen Wake Lock API is not supported in this browser.');
      return;
    }

    try {
      if (isWakeLockActive && wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setIsWakeLockActive(false);
      } else {
        const sentinel = await navigator.wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        setIsWakeLockActive(true);

        sentinel.addEventListener('release', () => {
          setIsWakeLockActive(false);
          setWakeLockSentinel(null);
        });
      }
    } catch (err) {
      console.error('[PWA] Wake lock error:', err);
    }
  }, [isWakeLockActive, wakeLockSentinel]);

  // Request Notification Permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch (err) {
      console.error('[PWA] Notification permission error:', err);
      return 'denied';
    }
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isSupported,
        isOnline,
        isStandalone,
        isInstallable: !!deferredPrompt,
        isIOS,
        updateAvailable,
        isWakeLockActive,
        notificationPermission,
        promptInstall,
        applyUpdate,
        toggleWakeLock,
        requestNotificationPermission,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return useContext(PWAContext);
}
