import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseEloInput, rankDebaters } from '../domain';
import {
    addDebater,
    MutationError,
    removeDebater,
    setDebaterElo,
    toggleGraduate,
} from '../data/mutations';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { Modal } from '../components/Modal';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';

export function PlayersPage() {
    const { isAdmin } = useAuth();
    const { debaters, practiceRounds, refresh } = useAppData();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [showGraduated, setShowGraduated] = useState(true);
    const [name, setName] = useState('');
    const [elo, setElo] = useState('1500');
    const [eloTarget, setEloTarget] = useState<string | null>(null);
    const [eloValue, setEloValue] = useState('');

    const ranked = useMemo(
        () => rankDebaters(debaters, practiceRounds, { showGraduated, search: q }),
        [debaters, practiceRounds, showGraduated, q]
    );

    async function onAdd(e: React.FormEvent) {
        e.preventDefault();
        const parsed = parseEloInput(elo, 1500);
        if (parsed == null) {
            toast.push('Starting Elo must be a number.', 'warning');
            return;
        }
        try {
            await addDebater(name, parsed, debaters);
            setName('');
            toast.push(`Added ${name.trim()}.`, 'success');
            await refresh();
        } catch (err) {
            toast.push(
                err instanceof MutationError ? err.message : 'Failed to add debater.',
                'error'
            );
        }
    }

    return (
        <div>
            <PageHeader kicker="Roster" title="Players" />
            {isAdmin && (
                <Card style={{ marginBottom: 20 }}>
                    <form onSubmit={(e) => void onAdd(e)} className="grid grid-3">
                        <div className="field">
                            <label htmlFor="debaterName">Name</label>
                            <input
                                id="debaterName"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="debaterElo">Starting Elo</label>
                            <input
                                id="debaterElo"
                                value={elo}
                                onChange={(e) => setElo(e.target.value)}
                            />
                        </div>
                        <div className="field" style={{ justifyContent: 'end' }}>
                            <label>&nbsp;</label>
                            <Button type="submit">Add debater</Button>
                        </div>
                    </form>
                </Card>
            )}
            <div className="row" style={{ marginBottom: 16 }}>
                <input
                    className="input"
                    placeholder="Search…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 280 }}
                />
                <label className="row" style={{ alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={showGraduated}
                        onChange={(e) => setShowGraduated(e.target.checked)}
                    />
                    Show graduated
                </label>
            </div>
            <Card>
                {ranked.length === 0 ? (
                    <EmptyState title="No players" body="Add a debater to the roster." />
                ) : (
                    ranked.map((d) => (
                        <div key={d.id} className="player-row">
                            <span className="num">#{d.rank}</span>
                            <Link to={`/app/players/${d.id}`}>
                                <strong>{d.name}</strong>
                            </Link>
                            <span className="elo">{Math.round(d.elo)}</span>
                            <span className="pill">{d.status}</span>
                            {isAdmin ? (
                                <span className="row">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            setEloTarget(d.id);
                                            setEloValue(String(Math.round(d.elo)));
                                        }}
                                    >
                                        Set Elo
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={async () => {
                                            await toggleGraduate(d);
                                            toast.push(`Status updated.`, 'success');
                                            await refresh();
                                        }}
                                    >
                                        {d.status === 'active' ? 'Graduate' : 'Activate'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={async () => {
                                            if (
                                                !confirm(
                                                    'Permanently remove this debater and their data?'
                                                )
                                            )
                                                return;
                                            await removeDebater(d.id);
                                            toast.push('Removed.', 'success');
                                            await refresh();
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </span>
                            ) : (
                                <span />
                            )}
                        </div>
                    ))
                )}
            </Card>
            {eloTarget && (
                <Modal title="Set Elo" onClose={() => setEloTarget(null)}>
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const debater = debaters.find((d) => d.id === eloTarget);
                            const parsed = parseEloInput(eloValue, NaN);
                            if (!debater || parsed == null || Number.isNaN(parsed)) {
                                toast.push('Enter a valid Elo.', 'warning');
                                return;
                            }
                            await setDebaterElo(debater, parsed);
                            toast.push(`Elo set to ${parsed}.`, 'success');
                            setEloTarget(null);
                            await refresh();
                        }}
                    >
                        <div className="field">
                            <label htmlFor="newElo">New Elo</label>
                            <input
                                id="newElo"
                                value={eloValue}
                                onChange={(e) => setEloValue(e.target.value)}
                            />
                        </div>
                        <Button type="submit">Save</Button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
