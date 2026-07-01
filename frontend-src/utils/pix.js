import QRCode from 'qrcode';

export const pixKeyPlaceholder = 'sua-chave-pix-aqui';

export function normalizePixText(value, maxLength) {
  return String(value || 'LOJA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 $%*+\-./:]/gi, '')
    .toUpperCase()
    .slice(0, maxLength);
}

export function emvField(id, value) {
  const text = String(value ?? '');
  return `${id}${String(text.length).padStart(2, '0')}${text}`;
}

export function crc16(payload) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function isPixKeyConfigured(store = {}) {
  const pixKey = String(store.pixKey || '').trim();
  return Boolean(pixKey && pixKey !== pixKeyPlaceholder);
}

export function buildPixPayload(amount, store = {}, txid = 'PEDIDO') {
  const pixKey = String(store.pixKey || '').trim();
  const merchantAccount = [
    emvField('00', 'br.gov.bcb.pix'),
    emvField('01', pixKey),
    emvField('02', 'Pedido pizzaria'),
  ].join('');
  const additionalData = emvField('05', normalizePixText(txid, 25) || 'PEDIDO');
  const payloadWithoutCrc = [
    emvField('00', '01'),
    emvField('26', merchantAccount),
    emvField('52', '0000'),
    emvField('53', '986'),
    emvField('54', Number(amount || 0).toFixed(2)),
    emvField('58', 'BR'),
    emvField('59', normalizePixText(store.pixMerchantName || store.name, 25)),
    emvField('60', normalizePixText(store.pixCity || 'BRASIL', 15)),
    emvField('62', additionalData),
    '6304',
  ].join('');

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
}

export async function createPixQrCodeDataUrl(payload) {
  if (!payload) {
    return '';
  }

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });
}
