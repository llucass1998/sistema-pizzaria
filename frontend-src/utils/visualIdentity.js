export const DEFAULT_NAVBAR_COLOR = '#970F0F';
export const DEFAULT_BRAND_COLOR = '#970F0F';
export const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value, fallback = DEFAULT_NAVBAR_COLOR) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const color = value.trim();
  return isValidHexColor(color) ? color : fallback;
}

function expandHex(hexColor) {
  const color = normalizeHexColor(hexColor).replace('#', '');
  if (color.length === 3) {
    return color
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  return color;
}

export function getContrastTextColor(hexColor) {
  const color = expandHex(hexColor);
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.6 ? '#0F172A' : '#FFFFFF';
}

export function isDarkHexColor(hexColor) {
  return getContrastTextColor(hexColor) === '#FFFFFF';
}

function setOrCreateMeta(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function setOrCreateLink(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function toAbsoluteUrl(url) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

export function applyVisualIdentity(settings = {}) {
  const navbarColor = normalizeHexColor(settings.navbarColor, DEFAULT_NAVBAR_COLOR);
  const brandColor = normalizeHexColor(settings.brandColor, DEFAULT_BRAND_COLOR);
  const navbarTextColor = getContrastTextColor(navbarColor);

  document.documentElement.style.setProperty('--navbar-color', navbarColor);
  document.documentElement.style.setProperty('--navbar-text-color', navbarTextColor);
  document.documentElement.style.setProperty('--brand-color', brandColor);

  setOrCreateMeta('meta[name="theme-color"]', {
    name: 'theme-color',
    content: navbarColor,
  });

  if (settings.faviconUrl) {
    setOrCreateLink('link[rel="icon"][data-dynamic-icon="true"]', {
      rel: 'icon',
      href: settings.faviconUrl,
      'data-dynamic-icon': 'true',
    });
  }

  if (settings.appleTouchIconUrl) {
    setOrCreateLink('link[rel="apple-touch-icon"]', {
      rel: 'apple-touch-icon',
      href: settings.appleTouchIconUrl,
    });
  }

  const socialImage = settings.openGraphImageUrl || settings.logoUrl;
  if (socialImage) {
    const absoluteSocialImage = toAbsoluteUrl(socialImage);
    setOrCreateMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: absoluteSocialImage,
    });
    setOrCreateMeta('meta[property="twitter:image"]', {
      property: 'twitter:image',
      content: absoluteSocialImage,
    });
  }
}
