import { t } from '../i18n/pt-BR';

const MARK_URL = `${import.meta.env.BASE_URL}favicon.svg`;

/** Brand lockup: the isometric skyline mark (same file as the favicon) and the wordmark. */
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <span className="logo" aria-label={t.appTitle} role="img">
      <img className="logo-mark" src={MARK_URL} width={size} height={size} alt="" />
      <span className="logo-word" aria-hidden="true">
        {t.appTitle.toUpperCase()}
      </span>
    </span>
  );
}
