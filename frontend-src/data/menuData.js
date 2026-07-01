export const store = {
  name: 'Pizzaria',
  hours: '18:00 - 23:30',
  address: 'Av. Principal, 123',
  phone: '(11) 9999-9999',
  whatsappNumber: '5511999999999',
  pixKey: 'sua-chave-pix-aqui',
  pixMerchantName: 'Pizzaria',
  pixCity: 'Rio de Janeiro',
};

export function getStoreFromSettings(settings = {}) {
  return {
    ...store,
    name: settings.storeName ?? settings.name ?? store.name,
    isOpen: settings.isOpen ?? true,
    hours: settings.hours ?? store.hours,
    address: settings.address ?? store.address,
    phone: settings.phone ?? store.phone,
    whatsappNumber: settings.whatsappNumber ?? store.whatsappNumber,
    pixKey: settings.pixKey ?? store.pixKey,
    pixMerchantName: settings.pixMerchantName ?? settings.storeName ?? store.pixMerchantName,
    pixCity: settings.pixCity ?? store.pixCity,
    deliveryFee: settings.deliveryFee !== undefined ? Number(settings.deliveryFee) : undefined,
    serviceFee: settings.serviceFee !== undefined ? Number(settings.serviceFee) : undefined,
    logoUrl: settings.logoUrl ?? '',
    faviconUrl: settings.faviconUrl ?? '',
    appleTouchIconUrl: settings.appleTouchIconUrl ?? '',
    openGraphImageUrl: settings.openGraphImageUrl ?? '',
    navbarColor: settings.navbarColor ?? '#970F0F',
    brandColor: settings.brandColor ?? '#970F0F',
  };
}

export function getMapsLink(currentStore = store) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${currentStore.address}, Brasil`,
  )}`;
}

export function getWhatsappLink(currentStore = store) {
  return `https://wa.me/${currentStore.whatsappNumber}?text=${encodeURIComponent(
    'Olá! Gostaria de tirar uma dúvida ou fazer um pedido.',
  )}`;
}

export const categories = [
  {
    id: 'pizzas',
    slug: 'pizzas',
    name: 'Pizzas',
    image: '🍕',
    description: 'Sabores classicos da casa com massa leve e bastante recheio.',
  },
  {
    id: 'pizzas-especiais',
    slug: 'pizzas-especiais',
    name: 'Pizzas Especiais',
    image: '🍕',
    description: 'Receitas caprichadas para quem quer sair do basico.',
  },
  {
    id: 'promocoes',
    slug: 'promocoes',
    name: 'Promocoes',
    image: '🔥',
    description: 'Combos e ofertas para pedir bem sem gastar demais.',
  },
  {
    id: 'bebidas',
    slug: 'bebidas',
    name: 'Bebidas',
    image: '🥤',
    description: 'Refrigerantes e bebidas geladas para acompanhar a pizza.',
  },
  {
    id: 'sobremesas',
    slug: 'sobremesas',
    name: 'Sobremesas',
    image: '🍫',
    description: 'Doces para fechar o pedido no clima certo.',
  },
  {
    id: 'combos',
    slug: 'combos',
    name: 'Combos',
    image: '📦',
    description: 'Pedidos prontos para dividir com a familia ou amigos.',
  },
];

const productImagesByCategory = {
  pizzas:
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'pizzas-especiais':
    'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80',
  promocoes:
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
  bebidas:
    'https://andinacocacola.vtexassets.com/arquivos/ids/159382-800-auto?aspect=true&height=auto&v=639163193134500000&width=800',
  sobremesas:
    'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
  combos:
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
};

const productImagesById = {
  1: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=900&q=80',
  2: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  3: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80',
  4: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
  5: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?auto=format&fit=crop&w=900&q=80',
  6: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  7: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=900&q=80',
  8: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
};

export const products = [
  { id: 1, name: 'Pizza Margherita', category: 'pizzas', price: 39.9, image: '🍕' },
  { id: 2, name: 'Pizza Calabresa', category: 'pizzas', price: 42.9, image: '🍕' },
  { id: 3, name: 'Pizza Quatro Queijos', category: 'pizzas', price: 46.9, image: '🍕' },
  { id: 4, name: 'Pizza Portuguesa', category: 'pizzas-especiais', price: 49.9, image: '🍕' },
  {
    id: 5,
    name: 'Pizza Frango com Catupiry',
    category: 'pizzas-especiais',
    price: 52.9,
    image: '🍕',
  },
  { id: 6, name: 'Combo Familia 2 Pizzas', category: 'combos', price: 89.9, image: '📦' },
  { id: 7, name: 'Combo Pizza + Refrigerante', category: 'promocoes', price: 59.9, image: '🔥' },
  { id: 8, name: 'Brownie de Chocolate', category: 'sobremesas', price: 14.9, image: '🍫' },
  { id: 9, name: 'Coca-Cola lata 350ml', category: 'bebidas', price: 7, image: '🥤' },
  { id: 10, name: 'Guarana Antarctica lata 350ml', category: 'bebidas', price: 7, image: '🥤' },
].map((product) => ({
  ...product,
  imageUrl: productImagesById[product.id] ?? productImagesByCategory[product.category],
}));

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatCurrencySafe(value) {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) {
    return formatCurrency(0);
  }
  return formatCurrency(num);
}

export function getCategory(categoryId) {
  return categories.find((category) => category.id === categoryId || category.slug === categoryId);
}

export function getProductsByCategory(categoryId) {
  return products.filter((product) => product.category === categoryId);
}

export function formatPhoneBR(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  
  // Se comecar com 55 e tiver 12 ou 13 digitos (codigo do pais + DDD + numero)
  if (cleaned.length >= 12 && cleaned.startsWith('55')) {
    const brPhone = cleaned.substring(2);
    if (brPhone.length === 11) {
      return `(${brPhone.substring(0, 2)}) ${brPhone.substring(2, 7)}-${brPhone.substring(7)}`;
    } else if (brPhone.length === 10) {
      return `(${brPhone.substring(0, 2)}) ${brPhone.substring(2, 6)}-${brPhone.substring(6)}`;
    }
  }
  
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  
  return phone;
}

export function formatItemCount(count) {
  const num = Number(count) || 0;
  return `${num} ${num === 1 ? 'item' : 'itens'}`;
}
