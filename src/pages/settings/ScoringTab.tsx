import { useDeferredValue, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
    computeAll,
    DEFAULT_CONFIG,
    getLocalDateString,
    gradeInputs,
    sameConfig,
    scoringRewrite,
    validateConfig,
    withEloConfig,
    type Division,
    type EloConfig,
    type Grade,
} from '../../domain';
import { saveScoring } from '../../data/mutations';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

type Form = Record<string, string>;

/** Each box: where it lives in the settings, and what to call it. */
const GROUPS: { title: string; note: string; fields: [string, string][] }[] = [
    {
        title: 'Tournaments',
        note: 'K is how far one tournament can move someone. Phantom teams are imaginary .500 entries in every tournament’s average, so a small field doesn’t swing it.',
        fields: [
            ['k', 'K'],
            ['phantoms', 'Phantom .500 teams'],
            ['bonuses.invitational', 'Invitational bonus'],
            ['bonuses.local', 'Local bonus'],
            ['bonuses.citron', 'Citron bonus'],
        ],
    },
    {
        title: 'Division bars',
        note: 'What results are measured against. The higher a division’s bar, the more the same record is worth there.',
        fields: [
            ['bars.Novice', 'Novice'],
            ['bars.JV', 'JV'],
            ['bars.Varsity', 'Varsity'],
        ],
    },
    {
        title: 'Starting Elo',
        note: 'Where someone new starts, by the division they first debate in. People who started at the old number move to the new one; anyone set by hand stays put.',
        fields: [
            ['startElo.Novice', 'Novice'],
            ['startElo.JV', 'JV'],
            ['startElo.Varsity', 'Varsity'],
        ],
    },
    {
        title: 'Practice rounds',
        note: 'K for the result, plus a little for showing up, win or lose.',
        fields: [
            ['practiceK', 'K'],
            ['practiceBonus', 'Showing-up bonus'],
        ],
    },
];

const get = (c: EloConfig, key: string): number => {
    const [a, b] = key.split('.');
    const v = (c as unknown as Record<string, unknown>)[a];
    return (b ? (v as Record<string, number>)[b] : v) as number;
};

const toForm = (c: EloConfig): Form =>
    Object.fromEntries(GROUPS.flatMap((g) => g.fields.map(([key]) => [key, String(get(c, key))])));

function toConfig(form: Form): EloConfig {
    const n = (key: string) => (form[key].trim() === '' ? NaN : Number(form[key]));
    const div = (prefix: string) =>
        ({ Novice: n(`${prefix}.Novice`), JV: n(`${prefix}.JV`), Varsity: n(`${prefix}.Varsity`) }) as Record<Division, number>;
    return {
        k: n('k'),
        phantoms: n('phantoms'),
        bonuses: { invitational: n('bonuses.invitational'), local: n('bonuses.local'), citron: n('bonuses.citron') },
        bars: div('bars'),
        startElo: div('startElo'),
        practiceK: n('practiceK'),
        practiceBonus: n('practiceBonus'),
    };
}

const signed = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

export function ScoringTab() {
    const data = useAppData();
    const toast = useToast();
    const [form, setForm] = useState<Form>(() => toForm(data.config));
    const [confirming, setConfirming] = useState(false);
    const today = getLocalDateString();

    const draft = useMemo(() => toConfig(form), [form]);
    const invalid = validateConfig(draft);
    const changed = !invalid && !sameConfig(draft, data.config);
    // the preview trails typing a little, so the boxes stay quick
    const shown = useDeferredValue(changed ? draft : null);

    const nowGrade = useMemo(() => gradeInputs(data.inputs, today), [data.inputs, today]);
    const preview = useMemo(() => {
        if (!shown || validateConfig(shown)) return null;
        const rewrite = scoringRewrite(data.inputs, data.config, shown);
        return withEloConfig(shown, () => ({
            rewrite,
            derived: computeAll(rewrite.inputs, today),
            grade: gradeInputs(rewrite.inputs, today),
        }));
    }, [shown, data.inputs, data.config, today]);

    const board = useMemo(() => {
        if (!preview) return [];
        const active = data.debaters.filter((d) => d.status === 'active');
        const nowRank = new Map([...active].sort((a, b) => b.elo - a.elo).map((d, i) => [d.id, i + 1]));
        return active
            .map((d) => ({ d, now: d.elo, next: preview.derived.people[d.id]?.elo ?? d.elo }))
            .sort((a, b) => b.next - a.next)
            .map((r, i) => ({ ...r, rank: i + 1, moved: (nowRank.get(r.d.id) ?? i + 1) - (i + 1) }));
    }, [preview, data.debaters]);
    const movers = [...board].sort((a, b) => Math.abs(b.next - b.now) - Math.abs(a.next - a.now)).slice(0, 6);

    const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

    return (
        <div className="scoring">
            <Card className="scoring-form">
                <div className="card-title">Scoring</div>
                <p className="note card-lead">
                    Changing these recalculates everyone from the first tournament. A backup is taken first.
                </p>
                <div className="scoring-groups">
                    {GROUPS.map((g) => (
                        <fieldset key={g.title} className="scoring-group">
                            <legend>{g.title}</legend>
                            <p className="note">{g.note}</p>
                            <div className="scoring-fields">
                                {g.fields.map(([key, label]) => {
                                    const was = get(data.config, key);
                                    const differs = form[key].trim() !== '' && Number(form[key]) !== was;
                                    return (
                                        <div key={key} className={`field${differs ? ' is-changed' : ''}`}>
                                            <label htmlFor={`sc-${key}`}>{label}</label>
                                            <input
                                                id={`sc-${key}`}
                                                inputMode="decimal"
                                                value={form[key]}
                                                onChange={(e) => set(key, e.target.value)}
                                            />
                                            <span className="scoring-was" aria-live="polite">
                                                {differs ? `was ${was}` : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    ))}
                </div>
                {invalid && (
                    <p className="access-error" role="alert">
                        {invalid}
                    </p>
                )}
                <div className="row scoring-actions">
                    <Button disabled={!changed} onClick={() => setConfirming(true)}>
                        Save and recalculate
                    </Button>
                    <Button variant="secondary" disabled={sameConfig(draft, data.config) && !invalid} onClick={() => setForm(toForm(data.config))}>
                        Reset to saved
                    </Button>
                    <Button variant="ghost" disabled={sameConfig(draft, DEFAULT_CONFIG)} onClick={() => setForm(toForm(DEFAULT_CONFIG))}>
                        Reset to original
                    </Button>
                </div>
            </Card>

            <Card className="scoring-preview">
                <div className="card-title">What would change</div>
                {!changed ? (
                    <GradeLine label="How well Elo going in has predicted results" grade={nowGrade} />
                ) : !preview ? (
                    <p className="note">Working it out…</p>
                ) : (
                    <>
                        <div className="grade-compare">
                            <GradeLine label="Now" grade={nowGrade} />
                            <GradeLine label="With these numbers" grade={preview.grade} versus={nowGrade} />
                        </div>
                        <p className="note scoring-rewrites">
                            Rewrites {preview.rewrite.tournaments.length} tournament
                            {preview.rewrite.tournaments.length === 1 ? '' : 's'} and{' '}
                            {preview.rewrite.people.length} starting Elo{preview.rewrite.people.length === 1 ? '' : 's'}.
                        </p>
                        <h3 className="scoring-sub">Biggest moves</h3>
                        <ul className="movers-list">
                            {movers.map((r) => (
                                <li key={r.d.id}>
                                    <Link to={`/app/players/${r.d.id}`}>{r.d.name}</Link>
                                    <span className="num muted">
                                        {Math.round(r.now)} to {Math.round(r.next)}
                                    </span>
                                    <span className={`delta num ${r.next >= r.now ? 'delta-pos' : 'delta-neg'}`}>
                                        {signed(r.next - r.now)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <h3 className="scoring-sub">The board with these numbers</h3>
                        <div className="preview-board" role="table" aria-label="Rankings with the new numbers">
                            <div className="preview-board__row preview-board__row--head" role="row">
                                <span role="columnheader">Rank</span>
                                <span role="columnheader">Name</span>
                                <span role="columnheader">Now</span>
                                <span role="columnheader">New</span>
                                <span role="columnheader">Change</span>
                                <span role="columnheader">Places</span>
                            </div>
                            {board.map((r) => (
                                <div key={r.d.id} className="preview-board__row" role="row">
                                    <span role="cell" className="figure">
                                        {r.rank}
                                    </span>
                                    <span role="cell" className="preview-board__name">
                                        {r.d.name}
                                    </span>
                                    <span role="cell" className="num muted">
                                        {Math.round(r.now)}
                                    </span>
                                    <span role="cell" className="num">
                                        {Math.round(r.next)}
                                    </span>
                                    <span role="cell" className={`num ${r.next >= r.now ? 'delta-pos' : 'delta-neg'}`}>
                                        {signed(r.next - r.now)}
                                    </span>
                                    <span role="cell" className="note">
                                        {r.moved > 0 ? `up ${r.moved}` : r.moved < 0 ? `down ${-r.moved}` : 'same'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>

            <AnimatePresence>
                {confirming && (
                    <ConfirmModal
                        title="Save the scoring numbers"
                        confirmLabel="Save and recalculate"
                        password
                        onClose={() => setConfirming(false)}
                        onConfirm={async (password) => {
                            await saveScoring(data, draft, password);
                            toast.push('Scoring saved. Everyone has been recalculated.', 'success');
                            await data.refresh();
                        }}
                    >
                        <p>
                            Everyone’s Elo and history will be worked out again from the first tournament with these numbers. A
                            backup of everything is taken first, so it can be put back from Backups.
                        </p>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </div>
    );
}

/** "Off by 1.23 wins an entry", with how it compares. */
function GradeLine({ label, grade, versus }: { label: string; grade: Grade; versus?: Grade }) {
    const diff = versus ? grade.miss - versus.miss : 0;
    return (
        <div className="grade">
            <span className="grade__label">{label}</span>
            <span className="grade__figure figure">{grade.miss.toFixed(2)}</span>
            <span className="note">
                wins off per tournament entry, on average, over {grade.entries} entries
                {versus &&
                    (Math.abs(diff) >= 0.005 ? (
                        <strong className={diff < 0 ? 'delta-pos' : 'delta-neg'}>
                            {' '}
                            ({diff < 0 ? 'better' : 'worse'} by {Math.abs(diff).toFixed(2)})
                        </strong>
                    ) : (
                        <strong> (about the same)</strong>
                    ))}
                {grade.called != null && `. Practice rounds won by the higher-rated side: ${Math.round(grade.called * 100)}%`}
            </span>
        </div>
    );
}
