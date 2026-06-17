// Surfaces validation errors that don't map to a single visible field (e.g.
// line-item or schedule errors) so a rejected save isn't silent.
export default function InvoiceFormErrors({ errors }: { errors: Partial<Record<string, string>> }) {
    const messages = Object.values(errors).filter(Boolean) as string[];
    if (messages.length === 0) return null;

    return (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-red-700">
                {messages.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>
        </div>
    );
}
