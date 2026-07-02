import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import ReactDOMServer from 'react-dom/server';
import { route } from 'ziggy-js';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => `${title} - ${appName}`,
        resolve: (name) =>
            resolvePageComponent(
                `./Pages/${name}.tsx`,
                import.meta.glob('./Pages/**/*.tsx'),
            ),
        setup: ({ App, props }) => {
            // Some (admin) pages call Ziggy's global route() during render. It's
            // shared into the page props by HandleInertiaRequests; expose it as the
            // same global the browser gets via @routes so those pages SSR cleanly.
            // Ziggy's overloaded signature doesn't lend itself to a typed wrapper,
            // so this glue is deliberately loose.
            const ziggy = (page.props as { ziggy?: { location: string } }).ziggy;
            if (ziggy) {
                /* eslint-disable @typescript-eslint/no-explicit-any */
                (globalThis as any).route = (name?: any, params?: any, absolute?: boolean) =>
                    (route as any)(name, params, absolute, { ...ziggy, location: new URL(ziggy.location) });
                /* eslint-enable @typescript-eslint/no-explicit-any */
            }

            return <App {...props} />;
        },
    }),
);
