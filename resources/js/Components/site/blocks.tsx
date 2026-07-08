/**
 * Barrel for the block system, which lives in ./blocks/*:
 *   - registry.ts     — BLOCK_LIBRARY (add new block types here) + tree helpers
 *   - ui.tsx          — shared primitives (RetryImg, inline editing, lightbox…)
 *   - BlockView.tsx   — the renderer switch + builder chrome
 *   - <Name>Block.tsx — one module per composite block
 * Existing `@/Components/site/blocks` imports keep working via this barrel.
 */
export * from './blocks/registry';
export * from './blocks/presets';
export * from './blocks/ui';
export * from './blocks/HeroSection';
export * from './blocks/SliderBlock';
export * from './blocks/ReviewsBlock';
export * from './blocks/BlogBlock';
export * from './blocks/GalleryBlock';
export * from './blocks/ContactBlock';
export * from './blocks/NewsletterBlock';
export * from './blocks/InstagramBlock';
export * from './blocks/BeforeAfterBlock';
export * from './blocks/CountdownBlock';
export * from './blocks/BookingBlock';
export * from './blocks/PostContext';
export * from './blocks/PostHeaderBlock';
export * from './blocks/BlockView';
