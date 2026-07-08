import { BlockEditorFieldsProps } from './fields';
import { HeroDesignFields } from './HeroDesignFields';

/**
 * The post-header block's editor. The heading, cover image, date and categories
 * come from the post itself (edited on the post's settings), so the block only
 * exposes the shared hero design controls.
 */
export function PostHeaderFields({ d, onChange }: BlockEditorFieldsProps) {
    return (
        <div className="space-y-3">
            <p className="text-xs text-neutral-400">The title, cover image, date and categories come from the post itself — edit those on the post's settings. These controls style the header.</p>
            <HeroDesignFields data={d} onChange={(partial) => onChange({ ...d, ...partial })} />
        </div>
    );
}
