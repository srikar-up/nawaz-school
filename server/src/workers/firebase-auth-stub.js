/** `firebase-admin/auth` replacement for the Workers build. */
import { lookupIdToken } from './google.js';

export function getAuth() {
  return {
    async verifyIdToken(idToken) {
      return lookupIdToken(idToken);
    },
  };
}
