import type { ReactNode } from 'react';
import { t } from '../i18n/pt-BR';

export function Panel({
  title,
  testId,
  onClose,
  className = '',
  children,
}: {
  title: string;
  testId: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`} data-testid={testId} aria-label={title}>
      <header className="panel-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={t.ui.close}
          title={t.ui.close}
        >
          ×
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
