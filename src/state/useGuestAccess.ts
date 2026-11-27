import { useEffect, useState } from 'react';
import { publicSettings } from '../data/settings';

/** Whether "Browse as guest" is on (true until the setting loads, and if it can't). */
export function useGuestAccess(fresh = false): boolean {
    const [on, setOn] = useState(true);
    useEffect(() => {
        let live = true;
        void publicSettings(fresh).then((s) => live && setOn(s.guestAccess));
        return () => {
            live = false;
        };
    }, [fresh]);
    return on;
}
