/** `firebase-admin/firestore` replacement for the Workers build. */
import { createRestFirestore } from './google.js';

export function getFirestore() {
  return createRestFirestore();
}
