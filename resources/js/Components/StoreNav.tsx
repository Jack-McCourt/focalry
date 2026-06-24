type Section = 'orders' | 'products' | 'coupons' | 'gift-cards' | 'settings';

// The Store sections now live in the left sidebar (the product-area menu in
// AuthenticatedLayout), so this in-page tab bar is retired. Kept as a no-op so
// the store pages that render it don't each need editing.
export default function StoreNav(_props: { active: Section }) {
    return null;
}
