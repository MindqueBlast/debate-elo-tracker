import { useEffect, useId, useRef, useState } from 'react';

export interface FinderLine {
    id: string;
    label: string;
    color: string;
}

/**
 * A small search over a chart's lines: type part of a name (a person or a
 * team), then pick a match to show it if it's hidden or hide it if it's shown.
 */
export function LineFinder({
    lines,
    hidden,
    onToggle,
}: {
    lines: FinderLine[];
    hidden: ReadonlySet<string>;
    onToggle: (id: string) => void;
}) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    const needle = q.trim().toLowerCase();
    const matches = needle
        ? lines
              .filter((l) => l.label.toLowerCase().includes(needle))
              // names starting with what you typed first, then A–Z
              .sort(
                  (a, b) =>
                      Number(!a.label.toLowerCase().startsWith(needle)) -
                          Number(!b.label.toLowerCase().startsWith(needle)) ||
                      a.label.localeCompare(b.label)
              )
              .slice(0, 8)
        : [];
    const showList = open && needle !== '';

    // clicking anywhere else closes the list
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const pick = (id: string) => onToggle(id);

    return (
        <div className="line-finder" ref={boxRef}>
            <input
                type="search"
                className="line-finder__input"
                placeholder="Find a line"
                aria-label="Find a person or team to show or hide"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
                value={q}
                onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setOpen(true);
                        setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActive((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && matches[active]) {
                        e.preventDefault();
                        pick(matches[active].id);
                    } else if (e.key === 'Escape') {
                        setQ('');
                        setOpen(false);
                    }
                }}
            />
            {showList && (
                <ul className="line-finder__list" id={listId} role="listbox" aria-label="Matching lines">
                    {matches.length === 0 ? (
                        <li className="line-finder__empty">No one by that name</li>
                    ) : (
                        matches.map((l, i) => {
                            const shown = !hidden.has(l.id);
                            return (
                                <li
                                    key={l.id}
                                    id={`${listId}-${i}`}
                                    role="option"
                                    aria-selected={i === active}
                                    aria-checked={shown}
                                    className={`line-finder__item${i === active ? ' is-active' : ''}`}
                                    // keep focus in the box so several lines can be flipped in a row
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => pick(l.id)}
                                >
                                    <span
                                        className={`line-finder__check${shown ? ' is-on' : ''}`}
                                        style={{ borderColor: l.color, background: shown ? l.color : 'transparent' }}
                                        aria-hidden="true"
                                    />
                                    <span className={`line-finder__name${shown ? '' : ' is-off'}`}>{l.label}</span>
                                    <span className="line-finder__state">{shown ? 'Shown' : 'Hidden'}</span>
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
