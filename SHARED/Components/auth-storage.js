// Apply the login page's remembered storage choice to Supabase clients sitewide.
(function () {
  'use strict';
  const MODE_KEY = 'bts_auth_storage_mode';

  const storage = {
    getItem(key) {
      const target = localStorage.getItem(MODE_KEY) === 'session' ? sessionStorage : localStorage;
      return target.getItem(key);
    },
    setItem(key, value) {
      const target = localStorage.getItem(MODE_KEY) === 'session' ? sessionStorage : localStorage;
      target.setItem(key, value);
    },
    removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };

  function wrap(clientLibrary) {
    if (!clientLibrary || typeof clientLibrary.createClient !== 'function' || clientLibrary.createClient.__btsAuthStorageWrapped) return;
    const originalCreateClient = clientLibrary.createClient.bind(clientLibrary);
    const wrappedCreateClient = function (url, key, options = {}) {
      const auth = options.auth || {};
      return originalCreateClient(url, key, {
        ...options,
        auth: { ...auth, storage: auth.storage || storage },
      });
    };
    wrappedCreateClient.__btsAuthStorageWrapped = true;
    clientLibrary.createClient = wrappedCreateClient;
  }

  window.BTSAuthStorage = { modeKey: MODE_KEY, storage };
  let library = window.supabase;
  Object.defineProperty(window, 'supabase', {
    configurable: true,
    get() { return library; },
    set(value) { library = value; wrap(value); },
  });
  if (library) wrap(library);
}());
