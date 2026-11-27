import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { CREATORS } from '../lib/credits';
import { useAppData } from '../state/AppDataProvider';

/** One quiet line at the foot of every page; each name opens that person's profile. */
export function AppCredits() {
    const { debaters } = useAppData();
    const profileOf = (first: string) => {
        const f = first.toLowerCase();
        return debaters.find((d) => {
            const n = d.name.trim().toLowerCase();
            return n === f || n.startsWith(`${f} `);
        });
    };

    return (
        <footer className="app-credits">
            <p className="app-credits__line">
                Made by{' '}
                {CREATORS.map((c, i) => {
                    const d = profileOf(c.first);
                    return (
                        <Fragment key={c.name}>
                            {i > 0 && ' and '}
                            {d ? (
                                <Link to={`/app/players/${d.id}`} className="app-credits__name">
                                    {c.name}
                                </Link>
                            ) : (
                                <span className="app-credits__name">{c.name}</span>
                            )}
                        </Fragment>
                    );
                })}
            </p>
        </footer>
    );
}
