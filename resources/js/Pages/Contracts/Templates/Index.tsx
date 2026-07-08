import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface TemplateRow {
    id: number;
    name: string;
    field_count: number;
    updated_at: string;
}

export default function Index({ templates }: PageProps<{ templates: TemplateRow[] }>) {
    const destroy = async (t: TemplateRow) => {
        if (await confirmDialog(`Delete the “${t.name}” template? This won't affect contracts already created from it.`)) {
            router.delete(route('contracts.templates.destroy', t.id), { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('contracts.index')} className="text-neutral-400 hover:text-neutral-700">Contracts</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Templates</span>
                </div>
            }
            actions={
                <Link href={route('contracts.templates.create')} className="btn-primary">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New template
                </Link>
            }
        >
            <Head title="Contract templates" />
            <StudioManagerNav active="contracts" />

            <div className="px-4 py-8 sm:px-8">
                <p className="mb-6 max-w-2xl text-sm text-neutral-500">
                    Templates are reusable starting points for contracts. Pick one when creating a contract, then tailor it to the client. Editing a template here does not change contracts already created from it.
                </p>

                {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No templates yet</p>
                        <p className="mt-1 text-sm text-neutral-500">Create a template to reuse contract wording.</p>
                        <Link href={route('contracts.templates.create')} className="btn-primary mt-6">New template</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="px-4 py-3">Name</th>
                                    <th className="hidden px-4 py-3 sm:table-cell">Fields</th>
                                    <th className="hidden px-4 py-3 md:table-cell">Updated</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {templates.map((t) => (
                                    <tr key={t.id} className="transition hover:bg-neutral-50">
                                        <td className="px-4 py-3 font-medium text-neutral-900">
                                            <Link href={route('contracts.templates.edit', t.id)} className="hover:underline">{t.name}</Link>
                                        </td>
                                        <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">{t.field_count}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{new Date(t.updated_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={route('contracts.templates.edit', t.id)} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">Edit</Link>
                                            <button onClick={() => destroy(t)} className="ml-4 text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
