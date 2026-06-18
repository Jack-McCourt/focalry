import { useEffect, useRef, useState } from 'react';

export interface SignatureValue {
    signer_name: string;
    signature_type: 'typed' | 'drawn';
    signature_data: string;
}

/**
 * Captures a signature either typed (rendered in a script font) or drawn on a
 * canvas (exported as a PNG data URL). `onChange` always receives the full
 * value; `signature_data` is the typed name for typed mode, or a data URL for
 * drawn mode.
 */
export default function SignaturePad({
    value,
    onChange,
}: {
    value: SignatureValue;
    onChange: (v: SignatureValue) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasDrawing, setHasDrawing] = useState(false);

    const setMode = (mode: 'typed' | 'drawn') => {
        if (mode === value.signature_type) return;
        onChange({ ...value, signature_type: mode, signature_data: mode === 'typed' ? value.signer_name : '' });
        setHasDrawing(false);
    };

    const setName = (name: string) => {
        onChange({
            ...value,
            signer_name: name,
            signature_data: value.signature_type === 'typed' ? name : value.signature_data,
        });
    };

    // Size the canvas backing store to its rendered size (crisp lines).
    useEffect(() => {
        if (value.signature_type !== 'drawn') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#171717';
        }
    }, [value.signature_type]);

    const pos = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent) => {
        drawing.current = true;
        last.current = pos(e);
        canvasRef.current?.setPointerCapture(e.pointerId);
    };

    const move = (e: React.PointerEvent) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !last.current) return;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        setHasDrawing(true);
    };

    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        last.current = null;
        const data = canvasRef.current?.toDataURL('image/png') ?? '';
        onChange({ ...value, signature_data: data });
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawing(false);
        onChange({ ...value, signature_data: '' });
    };

    return (
        <div>
            <input
                type="text"
                value={value.signer_name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="input mb-3"
            />

            <div className="mb-2 inline-flex rounded-lg border border-neutral-200 p-0.5 text-xs">
                <button type="button" onClick={() => setMode('typed')} className={`rounded-md px-3 py-1 font-medium transition ${value.signature_type === 'typed' ? 'bg-neutral-900 text-white' : 'text-neutral-500'}`}>Type</button>
                <button type="button" onClick={() => setMode('drawn')} className={`rounded-md px-3 py-1 font-medium transition ${value.signature_type === 'drawn' ? 'bg-neutral-900 text-white' : 'text-neutral-500'}`}>Draw</button>
            </div>

            {value.signature_type === 'typed' ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                    <span className="font-[cursive] text-3xl text-neutral-800">{value.signer_name || <span className="text-base text-neutral-300">Your signature appears here</span>}</span>
                </div>
            ) : (
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        onPointerDown={start}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerLeave={end}
                        className="h-24 w-full touch-none rounded-lg border border-neutral-200 bg-neutral-50"
                    />
                    {!hasDrawing && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-300">Draw your signature here</span>}
                    <button type="button" onClick={clear} className="absolute right-2 top-2 rounded bg-white/80 px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-800">Clear</button>
                </div>
            )}
        </div>
    );
}
