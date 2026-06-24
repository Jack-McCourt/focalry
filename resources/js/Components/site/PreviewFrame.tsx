import { ReactNode, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Renders its children inside an <iframe> so the preview has its own viewport
 * width. Tailwind's responsive breakpoints (`md:`, `lg:`…) are viewport-based,
 * so a same-document preview in a narrow column never stacks; inside an iframe
 * sized to the chosen device, the breakpoints fire exactly like the live site.
 *
 * A React root is mounted *inside* the iframe document (not a portal) so React's
 * event delegation lives in the frame — click-to-edit and the block chrome keep
 * working. The parent's stylesheets are copied in so Tailwind/app CSS apply.
 */
export default function PreviewFrame({ children }: { children: ReactNode }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const rootRef = useRef<Root | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument;
        if (!iframe || !doc) return;

        // Resolve root-relative asset URLs (CSS links, in-CSS url()s) against the app origin.
        const base = doc.createElement('base');
        base.href = window.location.origin + '/';
        doc.head.appendChild(base);

        // Copy the app's styles into the frame. Links are re-created with their
        // absolute href; inline <style> blocks are cloned verbatim.
        document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
            if (node.tagName === 'LINK') {
                const link = doc.createElement('link');
                link.rel = 'stylesheet';
                link.href = (node as HTMLLinkElement).href;
                doc.head.appendChild(link);
            } else {
                doc.head.appendChild(node.cloneNode(true));
            }
        });

        doc.documentElement.style.background = '#ffffff';
        doc.body.style.margin = '0';

        const mount = doc.createElement('div');
        doc.body.appendChild(mount);
        rootRef.current = createRoot(mount);
        setReady(true);

        return () => {
            const root = rootRef.current;
            rootRef.current = null;
            // Defer so we don't unmount synchronously during React's commit phase.
            setTimeout(() => root?.unmount(), 0);
        };
    }, []);

    // Re-render the frame's root whenever the previewed tree changes.
    useEffect(() => {
        if (ready) rootRef.current?.render(<>{children}</>);
    }, [ready, children]);

    return <iframe ref={iframeRef} title="Site preview" className="block h-full w-full" style={{ border: 0 }} />;
}
