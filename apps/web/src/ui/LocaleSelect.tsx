import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOCALES, LOCALE_LABELS, useStrings, type Locale } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';

function menuPosition(trigger: HTMLElement): { top: number; left: number; width: number } {
  const box = trigger.getBoundingClientRect();
  const width = Math.max(box.width, 168);
  const menuHeight = 188;
  const gap = 4;
  const below = window.innerHeight - box.bottom;
  const openUp = below < menuHeight && box.top > below;
  return {
    top: openUp ? Math.max(8, box.top - menuHeight - gap) : box.bottom + gap,
    left: Math.min(box.left, window.innerWidth - width - 8),
    width,
  };
}

/** Language picker with a themed list; a hidden native select keeps Playwright hooks. */
export function LocaleSelect({
  session,
  className = '',
  label,
}: {
  session: GameSession;
  className?: string;
  label?: string;
}) {
  const locale = useStore(session.ui, (s) => s.locale);
  const t = useStrings(session.ui);
  const caption = label ?? t.menu.language;
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 168 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const sync = () => {
      const trigger = triggerRef.current;
      if (trigger) setMenuBox(menuPosition(trigger));
    };
    // Ignore the opening gesture so the same pointerdown cannot close the list.
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 0);
    const onPointer = (event: PointerEvent) => {
      if (!armed) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', sync, true);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const trigger = triggerRef.current;
    if (!open && trigger) setMenuBox(menuPosition(trigger));
    setOpen((value) => !value);
  };

  const pick = (code: Locale) => {
    session.setLocale(code);
    setOpen(false);
  };

  return (
    <div className={`field locale-field ${className}`.trim()} ref={rootRef}>
      <span>{caption}</span>
      <select
        className="locale-native"
        value={locale}
        tabIndex={-1}
        aria-hidden="true"
        data-testid="locale-select"
        onChange={(e) => session.setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="locale-trigger"
        aria-label={caption}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={toggle}
      >
        <span>{LOCALE_LABELS[locale]}</span>
        <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className="locale-menu"
            role="listbox"
            aria-label={caption}
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {LOCALES.map((code) => (
              <li key={code} role="option" aria-selected={code === locale}>
                <button
                  type="button"
                  className={code === locale ? 'active' : ''}
                  onClick={() => pick(code)}
                >
                  {LOCALE_LABELS[code]}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
