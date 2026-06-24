import { Link } from '@inertiajs/react';

type Section =
    | 'contacts'
    | 'projects'
    | 'tasks'
    | 'proposals'
    | 'invoices'
    | 'contracts'
    | 'questionnaires'
    | 'workflows'
    | 'meetings'
    | 'bookings';

type SectionItem = { key: Section; label: string; href: string };
type Group = { key: string; label: string; items: SectionItem[] };

// Top-level groups. Each top tab opens its first section; a sub-nav row shows
// the sections within the active group.
const GROUPS: Group[] = [
    {
        key: 'clients',
        label: 'Clients',
        items: [
            { key: 'contacts', label: 'Contacts', href: '/contacts' },
            { key: 'projects', label: 'Projects', href: '/projects' },
        ],
    },
    {
        key: 'documents',
        label: 'Documents',
        items: [
            { key: 'proposals', label: 'Proposals', href: '/proposals' },
            { key: 'invoices', label: 'Invoices', href: '/invoices' },
            { key: 'contracts', label: 'Contracts', href: '/contracts' },
            { key: 'questionnaires', label: 'Questionnaires', href: '/questionnaires' },
        ],
    },
    {
        key: 'scheduling',
        label: 'Scheduling',
        items: [
            { key: 'meetings', label: 'Meetings', href: '/meetings' },
            { key: 'bookings', label: 'Bookings', href: '/packages' },
        ],
    },
    {
        key: 'automation',
        label: 'Automation',
        items: [
            { key: 'tasks', label: 'Tasks', href: '/tasks' },
            { key: 'workflows', label: 'Workflows', href: '/workflows' },
        ],
    },
];

// The Studio Manager sub-navigation now lives in the left sidebar (the
// product-area menu in AuthenticatedLayout), so this in-page horizontal tab bar
// is retired. Kept as a no-op component so the many pages that render it don't
// each need editing.
export default function StudioManagerNav(_props: { active: Section }) {
    return null;
}
