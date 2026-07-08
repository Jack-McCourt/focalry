import { createContext, useContext } from 'react';
import type { PostMeta } from './data';

/**
 * Carries the current blog post's data (title, cover, date, categories) down to
 * the `post_header` block, which renders it. SiteShell provides it on post
 * pages; it's null everywhere else, so a stray post-header block degrades to a
 * builder-only placeholder instead of crashing.
 */
export const PostContext = createContext<PostMeta | null>(null);

export const usePostMeta = () => useContext(PostContext);
