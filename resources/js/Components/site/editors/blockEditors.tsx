import { SiteBlockType } from '@/types';
import { ComponentType } from 'react';
import type { BlockEditorFieldsProps } from './fields';
import { InstagramFields } from './InstagramFields';
import { PostHeaderFields } from './PostHeaderFields';
import { ReviewsFields } from './ReviewsFields';
import { SliderFields } from './SliderFields';

/**
 * Per-block editor components. ContentFields consults this map before its
 * switch, so a block with a dedicated editor module needs no case there.
 *
 * Adding a block, the colocated way:
 *   1. data shape        → site/blocks/data.ts (+ the SiteBlockType union)
 *   2. meta + defaults   → site/blocks/registry.ts (BLOCK_LIBRARY)
 *   3. renderer          → site/blocks/<Name>Block.tsx (+ its BlockView case)
 *   4. editor            → editors/<Name>Fields.tsx, registered HERE
 *   5. picker thumbnail  → site/BlockPicker.tsx
 * Editors stay in this admin-only module graph so the public site bundle
 * never pulls in editor code (uploads, pickers, the WYSIWYG…).
 */
export const BLOCK_EDITORS: Partial<Record<SiteBlockType, ComponentType<BlockEditorFieldsProps>>> = {
    instagram: InstagramFields,
    post_header: PostHeaderFields,
    reviews: ReviewsFields,
    slider: SliderFields,
};
