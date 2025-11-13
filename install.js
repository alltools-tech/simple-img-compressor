// install.js
(() => {
  let deferredPrompt = null;
  const installBtn = document.getElementById('pwaInstallBtn');
  const updateBar = document.getElementById('pwaUpdateBar');

  // Before install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-block';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] userChoice', outcome);
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }

  // Listen for SW updates and notify user
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // new service worker has taken control
      console.log('[PWA] controller changed');
    });

    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      // handle updatefound
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content available, show update UI
              showUpdate();
            } else {
              // First install, cached
              console.log('[PWA] Content cached for offline use.');
            }
          }
        });
      });
    }).catch(err => console.error('[PWA] SW register failed', err));
  }

  function showUpdate() {
    if (!updateBar) {
      alert('A new version is available. Reload to update.');
      return;
    }
    updateBar.style.display = 'flex';
    const reloadBtn = updateBar.querySelector('.pwa-update-reload');
    reloadBtn.addEventListener('click', () => {
      // ask SW to skipWaiting
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  }
})();