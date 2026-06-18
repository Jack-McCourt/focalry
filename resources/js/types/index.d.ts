export interface User {
    id: number;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
}

export interface Studio {
    id: number;
    name: string;
    slug: string;
    plan: 'free' | 'basic' | 'plus' | 'pro' | 'ultimate';
    logo_path: string | null;
}

export interface Auth {
    user: User | null;
    studio: Studio | null;
}

export interface Flash {
    success: string | null;
    error: string | null;
}

import type { CoverStyle } from '@/lib/coverStyle';

export interface CollectionPrivacy {
    has_password: boolean;
    email_gate: boolean;
}

export interface CollectionDownloadSettings {
    enabled: boolean;
    allow_original: boolean;
    require_pin: boolean;
    has_pin: boolean;
}

export interface CollectionFavouriteSettings {
    enabled: boolean;
    show_notes: boolean;
}

export interface Collection {
    id: number;
    title: string;
    slug: string;
    event_date: string | null;
    status: 'draft' | 'published';
    cover_photo_id: number | null;
    cover_style: Partial<CoverStyle> | null;
    photos_count?: number;
    published_at: string | null;
    created_at: string;
    privacy: CollectionPrivacy | null;
    download_settings: CollectionDownloadSettings | null;
    favourite_settings: CollectionFavouriteSettings | null;
}

export interface Contact {
    id: number;
    first_name: string;
    last_name: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    status: 'lead' | 'client' | 'archived';
    notes: string | null;
    collections_count?: number;
    created_at: string;
    updated_at: string;
}

export interface InvoiceItem {
    id?: number;
    description: string;
    quantity: number | string;
    unit_amount_cents: number;
    position?: number;
}

export interface PaymentSchedule {
    id?: number;
    amount_cents: number;
    due_date: string | null;
    position?: number;
}

export interface InvoicePayment {
    id: number;
    amount_cents: number;
    method: 'manual' | 'stripe';
    reference: string | null;
    paid_on: string | null;
    created_at: string;
}

export interface Invoice {
    id: number;
    public_id: string;
    contact_id: number | null;
    contact?: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'company' | 'email' | 'phone' | 'name'> | null;
    project_id: number | null;
    project?: { id: number; name: string } | null;
    number: string;
    status: 'draft' | 'sent' | 'partial' | 'paid' | 'void';
    currency: string;
    issue_date: string | null;
    due_date: string | null;
    event_date: string | null;
    subtotal_cents: number;
    discount_cents: number;
    tax_rate: number | string;
    tax_cents: number;
    total_cents: number;
    amount_paid_cents: number;
    notes: string | null;
    payment_methods: ('card' | 'bank_transfer')[] | null;
    reminder_offsets: number[] | null;
    reminders_sent: string[] | null;
    sent_at: string | null;
    paid_at: string | null;
    items?: InvoiceItem[];
    schedules?: PaymentSchedule[];
    payments?: InvoicePayment[];
    created_at: string;
    updated_at: string;
}

export interface ProjectStatus {
    id: number;
    label: string;
    color: string;
}

export interface ProjectType {
    id: number;
    label: string;
    color: string;
}

export type ProjectFieldType = 'text' | 'long_text' | 'number' | 'date' | 'select' | 'checkbox' | 'url';

export interface ProjectFieldOption {
    label: string;
    color: string;
}

export interface ProjectFieldDefinition {
    id: number;
    key: string;
    label: string;
    type: ProjectFieldType;
    options: ProjectFieldOption[] | null;
}

export interface Project {
    id: number;
    name: string;
    event_date: string | null;
    status_id: number | null;
    type_id: number | null;
    contact_id: number | null;
    contact: { id: number; name: string } | null;
    notes: string | null;
    custom_fields: Record<string, unknown>;
    position: number;
}

export type ContractFieldType = 'text' | 'multiline' | 'date' | 'checkbox' | 'invoice';

export interface ContractField {
    key: string;
    label: string;
    type: ContractFieldType;
    fill_by: 'studio' | 'client';
    value?: string | boolean | null;
}

export interface ContractSignatureRecord {
    id: number;
    role: 'studio' | 'client';
    signer_name: string;
    signature_type: 'typed' | 'drawn';
    signature_data: string | null;
    signed_at: string;
}

export interface Contract {
    id: number;
    public_id: string;
    project_id: number | null;
    contact_id: number | null;
    title: string;
    body: string | null;
    fields: ContractField[];
    status: 'draft' | 'sent' | 'signed' | 'declined' | 'void';
    sent_at: string | null;
    signed_at: string | null;
    contact?: { id: number; name: string; email?: string | null } | null;
    project?: { id: number; name: string } | null;
    signatures?: ContractSignatureRecord[];
    created_at: string;
    updated_at: string;
}

export interface EmailOption {
    key: string;
    label: string;
    default: boolean;
}

export interface EmailDefaults {
    type: 'invoice' | 'contract' | 'collection';
    id: number;
    to: string | null;
    subject: string;
    body: string;
    cta_label: string;
    options: EmailOption[];
}

// ─── Website builder ────────────────────────────────────────────────────────

export type SiteFont = 'sans' | 'serif';

export interface SiteTheme {
    primary_color: string;
    font: SiteFont;
}

export type SiteBlockType =
    | 'hero'
    | 'about'
    | 'services'
    | 'gallery'
    | 'blog'
    | 'contact'
    | 'text'
    | 'image'
    | 'grid'
    | 'packages'
    | 'footer';

export interface BlockSettings {
    background?: string;
    text_color?: string;
    text_size?: 'sm' | 'base' | 'lg' | 'xl';
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface SiteNavItem {
    label: string;
    kind: 'page' | 'url';
    target: string;
}

export interface BlogPostCard {
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image: string | null;
    published_at: string | null;
    url?: string;
}

export interface PackageCard {
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price_cents: number;
    deposit_cents: number | null;
    currency: string;
    url?: string;
}

export interface SiteBlock<T = Record<string, unknown>> {
    id: string;
    type: SiteBlockType;
    data: T;
    settings?: BlockSettings;
    /** Nested blocks per column — used by the `grid` container block. */
    children?: SiteBlock[][];
}

export interface SitePageData {
    id?: number;
    parent_id?: number | null;
    is_post?: boolean;
    title: string;
    slug: string;
    is_home: boolean;
    is_blog?: boolean;
    status?: 'draft' | 'published';
    published_at?: string | null;
    excerpt?: string | null;
    cover_image?: string | null;
    blocks: SiteBlock[];
    seo_title?: string | null;
    seo_description?: string | null;
}

export interface SiteData {
    id: number;
    name: string;
    slug: string;
    template: string;
    theme: SiteTheme;
    header_nav: SiteNavItem[];
    footer_nav: SiteNavItem[];
    contact_email: string | null;
    seo_title: string | null;
    seo_description: string | null;
    is_published: boolean;
    published_at: string | null;
    pages: SitePageData[];
}

export interface SiteTemplateMeta {
    key: string;
    name: string;
    description: string;
}

export interface SiteLeadRow {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    event_date: string | null;
    event_type: string | null;
    message: string | null;
    contact: { id: number; name: string } | null;
    project: { id: number; name: string } | null;
    created_at: string;
}

export interface Photo {
    id: number;
    collection_id: number;
    set_id: number | null;
    filename: string;
    width: number | null;
    height: number | null;
    file_size: number | null;
    status: 'processing' | 'ready' | 'failed';
    position: number;
    starred: boolean;
    thumb_url: string | null;
    web_url: string | null;
    preview_url: string | null;
}

export interface GallerySet {
    id: number;
    collection_id: number;
    name: string;
    position: number;
    visible: boolean;
}

export interface ActivityVisitor {
    name: string | null;
    email: string | null;
}

export interface ActivityPhoto {
    id: number;
    filename: string;
    thumb_url: string | null;
    note: string | null;
}

export interface FavouriteActivity {
    id: number;
    name: string;
    visitor: ActivityVisitor | null;
    count: number;
    notes_count: number;
    photos: ActivityPhoto[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: Auth;
    flash: Flash;
};
