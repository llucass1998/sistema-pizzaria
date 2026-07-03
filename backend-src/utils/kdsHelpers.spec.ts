import { describe, it, expect } from 'vitest';
import { resolveKdsStation, resolvePrepTimeMinutes, getFallbackStationByName } from './kdsHelpers.js';

describe('kdsHelpers', () => {
  it('should resolve fallback station by name correctly', () => {
    expect(getFallbackStationByName('Pizza de Calabresa')).toBe('OVEN');
    expect(getFallbackStationByName('Calzone Especial')).toBe('OVEN');
    expect(getFallbackStationByName('Coca-Cola 2L')).toBe('BEVERAGE');
    expect(getFallbackStationByName('Suco de Laranja')).toBe('BEVERAGE');
    expect(getFallbackStationByName('Pudim de Leite')).toBe('DESSERT');
    expect(getFallbackStationByName('Porção de Fritas')).toBe('GENERAL');
  });

  it('should prioritize product kdsStation over category or name', () => {
    const res = resolveKdsStation(
      { kdsStation: 'BEVERAGE', name: 'Pizza Doce' },
      { kdsStation: 'OVEN', name: 'Pizzas' },
    );
    expect(res).toBe('BEVERAGE');
  });

  it('should prioritize category kdsStation if product kdsStation is missing', () => {
    const res = resolveKdsStation(
      { kdsStation: null, name: 'Pizza de Calabresa' },
      { kdsStation: 'ASSEMBLY', name: 'Especiais' },
    );
    expect(res).toBe('ASSEMBLY');
  });

  it('should fallback by name if both product and category station are missing', () => {
    const res = resolveKdsStation(
      { kdsStation: null, name: 'Bolo de Chocolate' },
      { kdsStation: null, name: 'Doces' },
    );
    expect(res).toBe('DESSERT');
  });

  it('should resolve prep time minutes properly', () => {
    expect(resolvePrepTimeMinutes('OVEN', 20, 15)).toBe(20);
    expect(resolvePrepTimeMinutes('OVEN', null, 18)).toBe(18);
    expect(resolvePrepTimeMinutes('OVEN', null, null)).toBe(15); // default OVEN
    expect(resolvePrepTimeMinutes('BEVERAGE', null, null)).toBe(3); // default BEVERAGE
  });
});
