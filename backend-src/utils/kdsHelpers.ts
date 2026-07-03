import { KdsStation } from '../../generated/prisma/index.js';

const STATION_DEFAULT_PREP_TIMES: Record<KdsStation, number> = {
  OVEN: 15,
  ASSEMBLY: 10,
  BEVERAGE: 3,
  DESSERT: 5,
  GENERAL: 10,
};

export function getFallbackStationByName(name: string = ''): KdsStation {
  const lower = name.toLowerCase();
  if (
    lower.includes('pizza') ||
    lower.includes('pizzaria') ||
    lower.includes('forno') ||
    lower.includes('calzone') ||
    lower.includes('borda')
  ) {
    return 'OVEN';
  }
  if (
    lower.includes('bebida') ||
    lower.includes('refrigerante') ||
    lower.includes('suco') ||
    lower.includes('água') ||
    lower.includes('agua') ||
    lower.includes('coca') ||
    lower.includes('guarana') ||
    lower.includes('guaraná') ||
    lower.includes('cerveja') ||
    lower.includes('vinho') ||
    lower.includes('chá') ||
    lower.includes('cha')
  ) {
    return 'BEVERAGE';
  }
  if (
    lower.includes('sobremesa') ||
    lower.includes('doce') ||
    lower.includes('bolo') ||
    lower.includes('pudim') ||
    lower.includes('sorvete') ||
    lower.includes('acai') ||
    lower.includes('açaí') ||
    lower.includes('chocolate') ||
    lower.includes('nutella')
  ) {
    return 'DESSERT';
  }
  return 'GENERAL';
}

export function resolveKdsStation(
  product?: { kdsStation?: string | null; name?: string | null } | null,
  category?: { kdsStation?: string | null; name?: string | null } | null,
  displayName?: string | null,
): KdsStation {
  if (product?.kdsStation && isValidStation(product.kdsStation)) {
    return product.kdsStation as KdsStation;
  }
  if (category?.kdsStation && isValidStation(category.kdsStation)) {
    return category.kdsStation as KdsStation;
  }
  const nameToTest = product?.name || displayName || category?.name || '';
  return getFallbackStationByName(nameToTest);
}

export function resolvePrepTimeMinutes(
  station: KdsStation,
  productPrepTime?: number | null,
  categoryPrepTime?: number | null,
): number {
  if (typeof productPrepTime === 'number' && productPrepTime > 0) {
    return Math.round(productPrepTime);
  }
  if (typeof categoryPrepTime === 'number' && categoryPrepTime > 0) {
    return Math.round(categoryPrepTime);
  }
  return STATION_DEFAULT_PREP_TIMES[station] || 10;
}

export function isValidStation(station?: string | null): boolean {
  if (!station) return false;
  return ['GENERAL', 'OVEN', 'ASSEMBLY', 'BEVERAGE', 'DESSERT'].includes(station.toUpperCase());
}
