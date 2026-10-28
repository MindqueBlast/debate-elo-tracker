import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/** A page only people who can edit should see; everyone else lands on Rankings. */
export function EditorsOnly({ children }: { children: ReactNode }) {
    const { isAdmin } = useAuth();
    return isAdmin ? <>{children}</> : <Navigate to="/app/rankings" replace />;
}
