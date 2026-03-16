'use client';

import { useState, useEffect } from 'react';

/**
 * Shows a banner on iOS Safari guiding users to "Add to Home Screen".
 * Only appears if:
 *  - Running on iOS
 *  - In Safari (not in-app browsers)
 *  - NOT already installed as PWA (standalone mode)
 *  - User hasn't dismissed it before
 */
export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already running as PWA?
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // @ts-ignore — safari-specific property
    if ((window.navigator as any).standalone === true) return;

    // Check if iOS
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;

    // Check if Safari (not Chrome/Firefox/etc on iOS — they can't install PWAs)
    // On iOS, Chrome and Firefox include "CriOS" or "FxiOS" in UA
    const isSafari = !(/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua));
    if (!isSafari) return;

    // Check if user already dismissed
    if (localStorage.getItem('ios-install-dismissed')) return;

    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('ios-install-dismissed', '1');
    setShow(false);
  };

  return (
    <div className="w-full max-w-xs mx-auto mb-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-blue-200 shadow-lg px-4 py-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Install MyAlphaPics</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Tap the <strong>Share</strong> button{' '}
            <span className="inline-block text-base leading-none align-middle">⬆️</span>{' '}
            at the bottom of Safari, then tap{' '}
            <strong>&ldquo;Add to Home Screen&rdquo;</strong>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
