/**
 * `firebase-admin/app` replacement for the Workers build.
 * No real Firebase App object is needed - the REST layer reads credentials
 * straight from the environment.
 */
let app = null;

export function initializeApp(options = {}) {
  app = options;
  return app;
}

export function getApps() {
  return app ? [app] : [];
}

export function cert(serviceAccount) {
  return { serviceAccount };
}

export function applicationDefault() {
  return { serviceAccount: null };
}
