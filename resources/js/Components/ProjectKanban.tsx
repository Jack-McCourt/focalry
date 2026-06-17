import { dotStyle } from '@/lib/projectColors';
import { Project, ProjectStatus, ProjectType } from '@/types';
import { useRef, useState } from 'react';

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

export default function ProjectKanban({
    projects,
    statuses,
    types,
    onMove,
    onOpen,
}: {
    projects: Project[];
    statuses: ProjectStatus[];
    types: ProjectType[];
    onMove: (movedId: number, statusId: number, orderedIds: number[]) => void;
    onOpen: (id: number) => void;
}) {
    const drag = useRef<{ id: number; x: number; y: number; started: boolean } | null>(null);
    const [dragId, setDragId] = useState<number | null>(null);
    const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
    const [hoverCol, setHoverCol] = useState<number | null>(null);

    const typeColor = (id: number | null) => types.find((t) => t.id === id)?.color ?? '#e5e7eb';
    const cardsFor = (statusId: number) =>
        projects.filter((p) => p.status_id === statusId).sort((a, b) => a.position - b.position);

    const onPointerDown = (e: React.PointerEvent, id: number) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { id, x: e.clientX, y: e.clientY, started: false };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        if (!d.started) {
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
            d.started = true;
            setDragId(d.id);
        }
        setGhost({ x: e.clientX, y: e.clientY });
        const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-status-col]');
        setHoverCol(col ? Number(col.getAttribute('data-status-col')) : null);
    };

    const onPointerUp = (e: React.PointerEvent, id: number) => {
        const d = drag.current;
        drag.current = null;
        setDragId(null);
        setGhost(null);
        setHoverCol(null);
        if (!d) return;

        if (!d.started) {
            onOpen(id); // treated as a click
            return;
        }

        const colEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-status-col]');
        if (!colEl) return;
        const statusId = Number(colEl.getAttribute('data-status-col'));

        // Insertion index: before the first card whose vertical midpoint is below the pointer.
        const cardEls = Array.from(colEl.querySelectorAll('[data-card-id]')).filter(
            (el) => Number(el.getAttribute('data-card-id')) !== id,
        );
        let index = cardEls.length;
        for (let i = 0; i < cardEls.length; i++) {
            const r = cardEls[i].getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) {
                index = i;
                break;
            }
        }

        const orderedIds = cardsFor(statusId).filter((p) => p.id !== id).map((p) => p.id);
        orderedIds.splice(index, 0, id);
        onMove(id, statusId, orderedIds);
    };

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((s) => {
                const cards = cardsFor(s.id);
                return (
                    <div
                        key={s.id}
                        data-status-col={s.id}
                        className={`flex w-72 shrink-0 flex-col rounded-xl border bg-neutral-50/60 transition ${
                            hoverCol === s.id && dragId !== null ? 'border-neutral-400 bg-neutral-100' : 'border-neutral-200'
                        }`}
                    >
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={dotStyle(s.color)} />
                            <span className="text-sm font-semibold text-neutral-800">{s.label}</span>
                            <span className="ml-auto text-xs text-neutral-400">{cards.length}</span>
                        </div>
                        <div className="flex min-h-[3rem] flex-1 flex-col gap-2 p-2">
                            {cards.map((p) => (
                                <div
                                    key={p.id}
                                    data-card-id={p.id}
                                    onPointerDown={(e) => onPointerDown(e, p.id)}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={(e) => onPointerUp(e, p.id)}
                                    className={`group relative touch-none cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                                        dragId === p.id ? 'opacity-40' : 'hover:border-neutral-300'
                                    }`}
                                >
                                    <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg" style={dotStyle(typeColor(p.type_id))} />
                                    <p className="pl-1.5 text-sm font-medium text-neutral-900">{p.name}</p>
                                    <div className="mt-1 flex items-center gap-2 pl-1.5 text-xs text-neutral-400">
                                        {p.contact && <span className="truncate">{p.contact.name}</span>}
                                        {p.contact && fmtDate(p.event_date) && <span>·</span>}
                                        {fmtDate(p.event_date) && <span>{fmtDate(p.event_date)}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Drag ghost */}
            {ghost && dragId !== null && (
                <div
                    className="pointer-events-none fixed z-50 w-64 rounded-lg border border-neutral-300 bg-white p-3 shadow-lg"
                    style={{ left: ghost.x + 8, top: ghost.y + 8 }}
                >
                    <p className="text-sm font-medium text-neutral-900">
                        {projects.find((p) => p.id === dragId)?.name}
                    </p>
                </div>
            )}
        </div>
    );
}
