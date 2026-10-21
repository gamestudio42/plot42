import { Logo as ChromeLogo } from '@shell/chrome';

const MARK_URL = `${import.meta.env.BASE_URL}favicon.svg`;

/** Urbe lockup: the isometric skyline mark and the wordmark. */
export function Logo({ size = 56, title = 'Urbe' }: { size?: number; title?: string }) {
  return <ChromeLogo size={size} title={title} markUrl={MARK_URL} />;
}
