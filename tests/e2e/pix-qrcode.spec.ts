import { describe, expect, it } from 'vitest';

import {
  buildPixPayload,
  createPixQrCodeDataUrl,
  isPixKeyConfigured,
  pixKeyPlaceholder,
} from '../../frontend-src/utils/pix.js';

const store = {
  name: 'Rio de Janeiro Pizzas',
  pixKey: 'contato@riopizzas.com.br',
  pixMerchantName: 'Rio de Janeiro Pizzas',
  pixCity: 'Rio de Janeiro',
};

describe('PIX QR Code', () => {
  it('rejects placeholder and empty PIX keys', () => {
    expect(isPixKeyConfigured({ pixKey: '' })).toBe(false);
    expect(isPixKeyConfigured({ pixKey: pixKeyPlaceholder })).toBe(false);
    expect(isPixKeyConfigured(store)).toBe(true);
  });

  it('builds a static PIX payload with CRC and no external QR URL', () => {
    const payload = buildPixPayload(53.9, store, 'E2E_TEST_PEDIDO');

    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('contato@riopizzas.com.br');
    expect(payload).toContain('540553.90');
    expect(payload).toMatch(/6304[A-F0-9]{4}$/);
    expect(payload).not.toContain('api.qrserver.com');
  });

  it('generates the QR image locally as a data URL', async () => {
    const payload = buildPixPayload(53.9, store);
    const dataUrl = await createPixQrCodeDataUrl(payload);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
