import { Link } from 'react-router-dom';
import { CREATORS } from '../lib/credits';
import { useAppData } from '../state/AppDataProvider';
import { FlapText } from './FlapText';
import { Logo } from './Logo';

/**
 * The scoreboard again, at the foot of every page: who made the tracker, on
 * flap tiles. Each name opens that person's profile when they're on the board.
 */
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
            <div className="app-credits__inner">
                <Link to="/" className="app-credits__brand">
                    <Logo size={20} />
                    Syosset Elo
                </Link>
                <p className="app-credits__made">Made by</p>
                <ul className="app-credits__names">
                    {CREATORS.map((c) => {
                        const d = profileOf(c.first);
                        const name = <FlapText text={c.name} className="flap--sm" />;
                        return (
                            <li key={c.name} className="app-credits__person">
                                {d ? (
                                    <Link to={`/app/players/${d.id}`} className="app-credits__name">
                                        {name}
                                    </Link>
                                ) : (
                                    <span className="app-credits__name">{name}</span>
                                )}
                                <span className="app-credits__role">{c.role}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </footer>
    );
}
