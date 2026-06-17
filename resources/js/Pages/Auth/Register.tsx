import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { COUNTRIES } from '@/lib/currencies';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

// Best-effort country guess from the browser locale — currency is derived from
// this server-side (no currency picker on sign-up).
function guessCountry(): string {
    try {
        const region = new Intl.Locale(navigator.language).region;
        if (region && COUNTRIES.some((c) => c.code === region)) return region;
    } catch {
        // ignore
    }
    return '';
}

const selectClasses =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        address_line1: '',
        address_line2: '',
        city: '',
        region: '',
        postal_code: '',
        country: guessCountry(),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Register" />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="name" value="Name" />

                    <TextInput
                        id="name"
                        name="name"
                        value={data.name}
                        className="mt-1 block w-full"
                        autoComplete="name"
                        isFocused={true}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />

                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="email" value="Email" />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password" value="Password" />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full"
                        autoComplete="new-password"
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel
                        htmlFor="password_confirmation"
                        value="Confirm Password"
                    />

                    <TextInput
                        id="password_confirmation"
                        type="password"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        className="mt-1 block w-full"
                        autoComplete="new-password"
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        required
                    />

                    <InputError
                        message={errors.password_confirmation}
                        className="mt-2"
                    />
                </div>

                {/* Business address */}
                <div className="mt-6 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-700">Business address</p>
                    <p className="text-xs text-gray-500">We use your country to set your default currency.</p>
                </div>

                <div className="mt-3">
                    <InputLabel htmlFor="address_line1" value="Address line 1" />
                    <TextInput
                        id="address_line1"
                        name="address_line1"
                        value={data.address_line1}
                        className="mt-1 block w-full"
                        autoComplete="address-line1"
                        onChange={(e) => setData('address_line1', e.target.value)}
                        required
                    />
                    <InputError message={errors.address_line1} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="address_line2" value="Address line 2 (optional)" />
                    <TextInput
                        id="address_line2"
                        name="address_line2"
                        value={data.address_line2}
                        className="mt-1 block w-full"
                        autoComplete="address-line2"
                        onChange={(e) => setData('address_line2', e.target.value)}
                    />
                    <InputError message={errors.address_line2} className="mt-2" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                        <InputLabel htmlFor="city" value="City" />
                        <TextInput
                            id="city"
                            name="city"
                            value={data.city}
                            className="mt-1 block w-full"
                            autoComplete="address-level2"
                            onChange={(e) => setData('city', e.target.value)}
                            required
                        />
                        <InputError message={errors.city} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="region" value="State / Region (optional)" />
                        <TextInput
                            id="region"
                            name="region"
                            value={data.region}
                            className="mt-1 block w-full"
                            autoComplete="address-level1"
                            onChange={(e) => setData('region', e.target.value)}
                        />
                        <InputError message={errors.region} className="mt-2" />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                        <InputLabel htmlFor="postal_code" value="Postal code" />
                        <TextInput
                            id="postal_code"
                            name="postal_code"
                            value={data.postal_code}
                            className="mt-1 block w-full"
                            autoComplete="postal-code"
                            onChange={(e) => setData('postal_code', e.target.value)}
                            required
                        />
                        <InputError message={errors.postal_code} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="country" value="Country" />
                        <select
                            id="country"
                            name="country"
                            value={data.country}
                            className={selectClasses}
                            onChange={(e) => setData('country', e.target.value)}
                            required
                        >
                            <option value="" disabled>Select a country</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                        <InputError message={errors.country} className="mt-2" />
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                    <Link
                        href={route('login')}
                        className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Already registered?
                    </Link>

                    <PrimaryButton className="ms-4" disabled={processing}>
                        Register
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
