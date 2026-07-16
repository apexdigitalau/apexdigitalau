/* Apex CRM — kill-switch service worker.
 *
 * A previous service worker cached hashed JS bundles with a cache-first
 * strategy. On iOS Safari / installed PWAs that left devices pinned to a stale
 * app shell, which broke the AI email generation flow (it worked in a private
 * tab precisely because no service worker was active there).
 *
 * This version does nothing but self-destruct: on activation it deletes every
 * cache, unregisters itself, and reloads any open clients so they reload the
 * live app from the network. Because it unregisters, it only runs once per
 * device — there is no reload loop and no lingering worker afterwards.
 *
 * Keep this file byte-different from the previously deployed sw.js so browsers
 * detect the update and install it.
 */

self.addEventListener('install', () => {
  // Take over immediately instead of waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // 1. Nuke every cache this origin ever created.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch (err) {
        // Best effort — keep going even if a delete fails.
      }

      // 2. Unregister so no service worker controls this origin going forward.
      try {
        await self.registration.unregister();
      } catch (err) {
        /* no-op */
      }

      // 3. Reload every open client so they drop the stale controlled page and
      //    fetch fresh HTML + bundles straight from the network.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        clients.map(client => {
          if ('navigate' in client) {
            return client.navigate(client.url).catch(() => {});
          }
          return Promise.resolve();
        })
      );
    })()
  );
});

// Never intercept fetches — always go straight to the network.
