import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { getLocalDateString, typeName } from '../../domain';
import { createBackup, getBackup, listBackups, restoreBackup, type BackupInfo } from '../../data/admin';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card, EmptyState } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const kb = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Cell = string | number | boolean | null | undefined;
const csv = (rows: Cell[][]) =>
    rows
        .map((r) =>
            r
                .map((c) => {
                    const s = c == null ? '' : typeof c === 'number' ? String(Math.round(c * 10) / 10) : String(c);
                    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                })
                .join(',')
        )
        .join('\r\n');

export function BackupsTab({ actor }: { actor: string }) {
    const data = useAppData();
    const toast = useToast();
    const [backups, setBackups] = useState<BackupInfo[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [restoring, setRestoring] = useState<BackupInfo | null>(null);

    const load = useCallback(async () => {
        try {
            setBackups(await listBackups(actor));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the backups.');
        }
    }, [actor]);

    useEffect(() => {
        void load();
    }, [load, data.revision]);

    async function takeNow() {
        setBusy(true);
        try {
            await createBackup(actor);
            toast.push('Backup taken.', 'success');
            await load();
        } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Could not take a backup.', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function saveJson(b: BackupInfo) {
        try {
            const all = await getBackup(actor, b.id);
            download(`syosset-elo-backup-${b.created_at.slice(0, 10)}.json`, JSON.stringify(all, null, 2), 'application/json');
        } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Could not download that backup.', 'error');
        }
    }

    // ------------------------------------------------- spreadsheets of today's data
    const name = new Map(data.debaters.map((d) => [d.id, d.name]));
    const nameOf = (id: string | null | undefined) => (id ? name.get(id) ?? '' : '');
    const today = getLocalDateString();
    const sheets: { label: string; file: string; rows: () => Cell[][] }[] = [
        {
            label: 'Rankings',
            file: 'rankings',
            rows: () => [
                ['Rank', 'Name', 'Class', 'Division', 'Status', 'Elo', 'Starting Elo'],
                ...[...data.debaters]
                    .sort((a, b) => b.elo - a.elo)
                    .map((d, i) => [i + 1, d.name, d.class_year, d.division, d.status, d.elo, d.start_elo]),
            ],
        },
        {
            label: 'Results',
            file: 'results',
            rows: () => [
                ['Date', 'Tournament', 'Type', 'Counts', 'Division', 'Debater', 'Partner', 'Raw wins', 'Rounds', 'Lost a round', 'Change', 'Partner change'],
                ...[...data.tournaments]
                    .sort((a, b) => (a.date < b.date ? -1 : 1))
                    .flatMap((t) =>
                        t.tournament_participants.map((p) => [
                            t.date,
                            t.name,
                            typeName(t.bonus, data.config),
                            t.rated !== false ? 'yes' : 'no',
                            p.division,
                            nameOf(p.debater_id),
                            nameOf(p.partner_id),
                            p.raw_wins,
                            p.rounds,
                            p.lost == null ? '' : p.lost ? 'yes' : 'no',
                            p.elo_change,
                            p.partner_id ? p.partner_elo_change ?? p.elo_change : null,
                        ])
                    ),
            ],
        },
        {
            label: 'Tournaments',
            file: 'tournaments',
            rows: () => [
                ['Date', 'Name', 'Type', 'Bonus', 'K', 'Counts', 'E_tourney', 'Entries'],
                ...[...data.tournaments]
                    .sort((a, b) => (a.date < b.date ? -1 : 1))
                    .map((t) => [
                        t.date,
                        t.name,
                        typeName(t.bonus, data.config),
                        t.bonus,
                        t.affect,
                        t.rated !== false ? 'yes' : 'no',
                        t.e_tourney,
                        t.tournament_participants.length,
                    ]),
            ],
        },
        {
            label: 'Practice rounds',
            file: 'practice-rounds',
            rows: () => [
                ['Date', 'Winner', 'Winner’s partner', 'Loser', 'Loser’s partner', 'Winner change', 'Loser change'],
                ...[...data.practiceRounds]
                    .sort((a, b) => (a.date < b.date ? -1 : 1))
                    .map((r) => [
                        r.date,
                        nameOf(r.winner_id),
                        nameOf(r.winner_partner_id),
                        nameOf(r.loser_id),
                        nameOf(r.loser_partner_id),
                        r.winner_change,
                        r.loser_change,
                    ]),
            ],
        },
    ];

    return (
        <div className="backups-tab">
            <Card>
                <div className="card-title">Spreadsheets</div>
                <p className="note card-lead">
                    Today’s data as .csv files, which Excel and Google Sheets open.
                </p>
                <div className="row">
                    {sheets.map((s) => (
                        <Button
                            key={s.file}
                            variant="secondary"
                            onClick={() => download(`syosset-elo-${s.file}-${today}.csv`, `﻿${csv(s.rows())}`, 'text/csv')}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            </Card>

            <Card>
                <div className="card-title">Backups</div>
                <p className="note card-lead">
                    Every table, kept on the server. One is taken before scoring changes, the new season, merges and restores;
                        the newest 60 are kept.
                </p>
                <div className="row backups-actions">
                    <Button disabled={busy} onClick={() => void takeNow()}>
                        {busy ? 'Taking a backup…' : 'Take a backup now'}
                    </Button>
                </div>
                {error ? (
                    <EmptyState title="Couldn’t load the backups" body={error} />
                ) : backups === null ? (
                    <p className="note">Loading…</p>
                ) : backups.length === 0 ? (
                    <EmptyState title="No backups yet" body="Take one now, or one is taken before the next big change." />
                ) : (
                    <ol className="backup-list">
                        {backups.map((b) => (
                            <li key={b.id} className="backup-row">
                                <span className="backup-row__main">
                                    <strong>{when(b.created_at)}</strong>
                                    <span className="note">
                                        {b.reason}
                                        {b.actor ? `, by ${b.actor.split('@')[0]}` : ''}
                                    </span>
                                </span>
                                <span className="note num backup-row__size">
                                    {b.people} people, {b.tournaments} tournaments, {kb(b.bytes)}
                                </span>
                                <span className="row backup-row__actions">
                                    <Button size="sm" variant="secondary" onClick={() => void saveJson(b)}>
                                        Download
                                    </Button>
                                    <Button size="sm" variant="danger" onClick={() => setRestoring(b)}>
                                        Restore
                                    </Button>
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </Card>

            <AnimatePresence>
                {restoring && (
                    <ConfirmModal
                        title="Restore a backup"
                        confirmLabel="Restore it"
                        danger
                        password
                        onClose={() => setRestoring(null)}
                        onConfirm={async (password) => {
                            await restoreBackup(actor, password, restoring.id);
                            toast.push(`Restored the backup from ${when(restoring.created_at)}.`, 'success');
                            await data.refresh();
                            await load();
                        }}
                    >
                        <p>
                            Everything goes back to how it was on <strong>{when(restoring.created_at)}</strong>: people, results,
                            teams and scoring numbers. Anything saved since is undone. A backup of how things stand now is taken
                            first, so this can be reversed.
                        </p>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </div>
    );
}
