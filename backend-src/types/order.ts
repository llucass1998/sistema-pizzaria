// Formato esperado para cada item enviado ao criar um pedido.
export type OrderItemInput = {
  productId?: string;
  name?: string;
  displayName?: string;
  category?: string;
  customizations?: string;
  variantId?: string;
  optionIds?: string[];
  addonIds?: string[];
  crustId?: string;
  addons?: Array<{ id?: string }>;
  crust?: { id?: string } | null;
  halfAndHalf?: {
    secondProductId?: string;
    secondVariantId?: string;
    secondProductName?: string;
    secondVariantName?: string;
  } | null;
  basePrice?: number | string;
  price?: number | string;
  imageUrl?: string;
  quantity?: number;
};
