import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { COUNTRIES, CURRENCIES } from '@/lib/currencies';
import { Transition } from '@headlessui/react';
import { router, useForm } from '@inertiajs/react';
import { FormEventHandler, useRef } from 'react';

export interface StudioSettings {
    name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
    default_currency: string;
    email_signature: string | null;
    stripe_connect_status: string | null;
    logo_url: string | null;
}

const selectClasses =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500';

export default function StudioSettingsForm({
    studio,
    className = '',
}: {
    studio: StudioSettings;
    className?: string;
}) {
    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: studio.name ?? '',
        address_line1: studio.address_line1 ?? '',
        address_line2: studio.address_line2 ?? '',
        city: studio.city ?? '',
        region: studio.region ?? '',
        postal_code: studio.postal_code ?? '',
        country: studio.country ?? '',
        default_currency: studio.default_currency ?? 'gbp',
        email_signature: studio.email_signature ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('studio.update'), { preserveScroll: true });
    };

    const logoForm = useForm<{ logo: File | null }>({ logo: null });
    const fileRef = useRef<HTMLInputElement>(null);

    const uploadLogo = (file: File | null) => {
        if (!file) return;
        logoForm.setData('logo', file);
        logoForm.post(route('studio.logo.upload'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                logoForm.reset();
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    const removeLogo = () => router.delete(route('studio.logo.delete'), { preserveScroll: true });

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Studio details</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Your business name, logo, address, and the default currency for new invoices.
                </p>
            </header>

            {/* Logo */}
            <div className="mt-6">
                <InputLabel value="Logo" />
                <p className="mt-1 text-sm text-gray-500">Shown on invoices. PNG or JPG, up to 2&nbsp;MB.</p>
                <div className="mt-2 flex items-center gap-4">
                    <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
                        {studio.logo_url ? (
                            <img src={studio.logo_url} alt="Studio logo" className="max-h-14 max-w-[7.5rem] object-contain" />
                        ) : (
                            <span className="text-xs text-gray-400">No logo</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
                            className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                        />
                        {studio.logo_url && (
                            <button type="button" onClick={removeLogo} className="text-sm text-red-600 hover:text-red-800">
                                Remove
                            </button>
                        )}
                    </div>
                </div>
                {logoForm.progress && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
                <InputError message={logoForm.errors.logo} className="mt-2" />
            </div>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div>
                    <InputLabel htmlFor="studio_name" value="Studio name" />
                    <TextInput
                        id="studio_name"
                        value={data.name}
                        className="mt-1 block w-full"
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="address_line1" value="Address line 1" />
                    <TextInput
                        id="address_line1"
                        value={data.address_line1}
                        className="mt-1 block w-full"
                        autoComplete="address-line1"
                        onChange={(e) => setData('address_line1', e.target.value)}
                    />
                    <InputError message={errors.address_line1} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="address_line2" value="Address line 2" />
                    <TextInput
                        id="address_line2"
                        value={data.address_line2}
                        className="mt-1 block w-full"
                        autoComplete="address-line2"
                        onChange={(e) => setData('address_line2', e.target.value)}
                    />
                    <InputError message={errors.address_line2} className="mt-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <InputLabel htmlFor="city" value="City" />
                        <TextInput
                            id="city"
                            value={data.city}
                            className="mt-1 block w-full"
                            autoComplete="address-level2"
                            onChange={(e) => setData('city', e.target.value)}
                        />
                        <InputError message={errors.city} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="region" value="State / Region" />
                        <TextInput
                            id="region"
                            value={data.region}
                            className="mt-1 block w-full"
                            autoComplete="address-level1"
                            onChange={(e) => setData('region', e.target.value)}
                        />
                        <InputError message={errors.region} className="mt-2" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <InputLabel htmlFor="postal_code" value="Postal code" />
                        <TextInput
                            id="postal_code"
                            value={data.postal_code}
                            className="mt-1 block w-full"
                            autoComplete="postal-code"
                            onChange={(e) => setData('postal_code', e.target.value)}
                        />
                        <InputError message={errors.postal_code} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="country" value="Country" />
                        <select
                            id="country"
                            value={data.country}
                            className={selectClasses}
                            onChange={(e) => setData('country', e.target.value)}
                        >
                            <option value="">— Select —</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                        <InputError message={errors.country} className="mt-2" />
                    </div>
                </div>

                <div>
                    <InputLabel htmlFor="default_currency" value="Default currency" />
                    <select
                        id="default_currency"
                        value={data.default_currency}
                        className={selectClasses}
                        onChange={(e) => setData('default_currency', e.target.value)}
                    >
                        {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                    </select>
                    <InputError message={errors.default_currency} className="mt-2" />
                    <p className="mt-1 text-sm text-gray-500">Used for new invoices. You can override it per invoice.</p>
                </div>

                <div>
                    <InputLabel htmlFor="email_signature" value="Message signature" />
                    <textarea
                        id="email_signature"
                        value={data.email_signature}
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        onChange={(e) => setData('email_signature', e.target.value)}
                        placeholder={'— ' + (data.name || 'Your studio')}
                    />
                    <InputError message={errors.email_signature} className="mt-2" />
                    <p className="mt-1 text-sm text-gray-500">
                        Appended to the bottom of client messages. Supports basic Markdown (**bold**, *italic*, links).
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>
                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
