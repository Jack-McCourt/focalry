import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import StripeConnectCard from './Partials/StripeConnectCard';
import StudioSettingsForm, { StudioSettings } from './Partials/StudioSettingsForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
    studio,
    stripe_key,
}: PageProps<{ mustVerifyEmail: boolean; status?: string; studio: StudioSettings | null; stripe_key: string }>) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                    </div>

                    {studio && (
                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <StudioSettingsForm studio={studio} className="max-w-xl" />
                        </div>
                    )}

                    {studio && (
                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <StripeConnectCard status={studio.stripe_connect_status} stripeKey={stripe_key} className="max-w-xl" />
                        </div>
                    )}

                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <UpdatePasswordForm className="max-w-xl" />
                    </div>

                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <DeleteUserForm className="max-w-xl" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
