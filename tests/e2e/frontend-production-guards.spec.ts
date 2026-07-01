import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('frontend production guards', () => {
  it('does not reference the removed useSwInfo hook', () => {
    const files = [
      'frontend-src/App.jsx',
      'frontend-src/main.jsx',
      'frontend-src/components/ErrorBoundary.jsx',
      'frontend-src/components/ui/CartDrawer.jsx',
      'frontend-src/components/ui/FloatingCartButton.jsx',
      'frontend-src/components/ui/BottomNav.jsx',
    ];

    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toContain('useSwInfo');
    }
  });

  it('keeps the cart drawer accessible without hiding the focused dialog', () => {
    const cartDrawer = readFileSync('frontend-src/components/ui/CartDrawer.jsx', 'utf8');

    expect(cartDrawer).toContain('role="dialog"');
    expect(cartDrawer).toContain('aria-modal="true"');
    expect(cartDrawer).toContain('closeButtonRef.current?.focus()');
    expect(cartDrawer).toContain('openerRef.current.focus()');
    expect(cartDrawer).not.toContain('aria-hidden={!isOpen}');
  });
});
