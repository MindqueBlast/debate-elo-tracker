import { useEffect, useRef, useState } from 'react';

export interface ClassChoice {
    key: string;
    label: string;
    /** People (or teams) in the class. */
    count: number;
}

export interface ClassShortcut {
    label: string;
    keys: string[];
}

const sameKeys = (a: string[], b: string[]) =>
    a.length === b.length && a.every((k) => b.includes(k));

/**
 * Which classes a chart shows: a button that opens a checklist. Shortcuts at
 * the top pick a whole group at once (and clicking one that's on clears it);
 * each class below can be ticked on its own.
 */
export function ClassPicker({
    id,
    classes,
    selected,
    shortcuts,
    noun = ['person', 'people'],
    onChange,
}: {
    id: string;
    classes: ClassChoice[];
    selected: string[];
    shortcuts: ClassShortcut[];
    /** What the counts count (one, many), for the button's summary. */
    noun?: [string, string];
    onChange: (keys: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // clicking anywhere else or pressing Escape closes it
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const picked = classes.filter((c) => selected.includes(c.key));
    const total = picked.reduce((sum, c) => sum + c.count, 0);
    const shortcut = shortcuts.find((s) => s.keys.length > 0 && sameKeys(s.keys, selected));
    const years = picked.map((c) => c.label.replace(/^Class of /, ''));
    const summary =
        picked.length === 0
            ? 'No classes'
            : shortcut
              ? shortcut.label
              : picked.length === 1
                ? picked[0].label
                : picked.length <= 3 && picked.every((c) => c.label.startsWith('Class of '))
                  ? `Classes of ${years.slice(0, -1).join(', ')} & ${years[years.length - 1]}`
                  : `${picked.length} classes`;

    const toggle = (key: string) =>
        onChange(
            selected.includes(key)
                ? selected.filter((k) => k !== key)
                : classes.map((c) => c.key).filter((k) => k === key || selected.includes(k))
        );

    return (
        <div className="class-picker" ref={boxRef}>
            <button
                ref={buttonRef}
                id={id}
                type="button"
                className="class-picker__button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="class-picker__summary">
                    {summary}
                    {picked.length > 0 && (
                        <span className="class-picker__total">
                            {' '}
                            ({total} {total === 1 ? noun[0] : noun[1]})
                        </span>
                    )}
                </span>
                <svg className="class-picker__chevron" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
            </button>
            {open && (
                <div className="class-picker__panel" role="group" aria-label="Classes to show">
                    {shortcuts.map((s) => {
                        const on = sameKeys(s.keys, selected);
                        const count = classes
                            .filter((c) => s.keys.includes(c.key))
                            .reduce((sum, c) => sum + c.count, 0);
                        return (
                            <button
                                key={s.label}
                                type="button"
                                className="class-picker__shortcut"
                                aria-pressed={on}
                                // clicking one that's on turns it off, leaving nothing picked
                                onClick={() => onChange(on ? [] : s.keys)}
                            >
                                <svg className="class-picker__tick" viewBox="0 0 12 12" aria-hidden="true">
                                    {on && (
                                        <path d="M2 6.5 5 9.2 10 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                    )}
                                </svg>
                                <span>{s.label}</span>
                                <span className="class-picker__count">{count}</span>
                            </button>
                        );
                    })}
                    {shortcuts.length > 0 && <div className="class-picker__divider" role="separator" />}
                    {classes.map((c) => (
                        <label key={c.key} className="class-picker__item">
                            <input
                                type="checkbox"
                                checked={selected.includes(c.key)}
                                onChange={() => toggle(c.key)}
                            />
                            <span>{c.label}</span>
                            <span className="class-picker__count">{c.count}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
