import { initializeApp } from 'firebase/app';
import {
    GoogleAuthProvider,
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    type User,
} from 'firebase/auth';
import { env } from '../lib/env';

const app = initializeApp(env.firebase);
export const firebaseAuth = getAuth(app);
const provider = new GoogleAuthProvider();

export function signInWithGoogle(): Promise<void> {
    return signInWithPopup(firebaseAuth, provider).then(() => undefined);
}

export function signOutUser(): Promise<void> {
    return signOut(firebaseAuth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
    return onAuthStateChanged(firebaseAuth, callback);
}
