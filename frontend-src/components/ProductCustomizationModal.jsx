import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  AlertCircle,
  Pizza,
  Layers,
  Plus,
  Info,
} from 'lucide-react';

export function ProductCustomizationModal({
  isOpen,
  product,
  onClose,
  onAddToCart,
  catalogProducts = [],
  dbAddons = [],
  dbCrusts = [],
}) {
  if (!isOpen || !product) return null;

  // Formatação de moeda
  const formatCurrency = (val) => {
    return Number(val ?? 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Verifica se o produto é pizza
  const isPizza = useMemo(() => {
    const cat = (product.category || '').toLowerCase();
    return (
      cat === 'pizzas' ||
      cat === 'pizzas-tradicionais' ||
      cat === 'pizzas-especiais' ||
      cat === 'pizzas-doces' ||
      cat === 'especiais' ||
      Boolean(product.allowHalfAndHalf)
    );
  }, [product]);

  // Lista de tamanhos disponíveis
  const variants = useMemo(() => {
    return (product.variants || []).filter((v) => v.isAvailable !== false);
  }, [product]);

  // Estado das seleções
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedCrustId, setSelectedCrustId] = useState('');
  const [isHalfAndHalf, setIsHalfAndHalf] = useState(false);
  const [selectedHalfProductId, setSelectedHalfProductId] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [validationError, setValidationError] = useState('');

  // Inicializa o tamanho selecionado se houver variante
  useEffect(() => {
    if (variants.length > 0) {
      setSelectedVariantId(variants[0].id);
    } else {
      setSelectedVariantId('');
    }
    setSelectedCrustId('');
    setIsHalfAndHalf(false);
    setSelectedHalfProductId('');
    setSelectedAddonIds([]);
    setValidationError('');
  }, [product, variants]);

  // Passos ativos calculados dinamicamente
  const activeSteps = useMemo(() => {
    const steps = [];
    if (variants.length > 0) {
      steps.push({ id: 1, label: 'Tamanho', icon: Layers });
    }
    if (isPizza || dbCrusts.length > 0) {
      steps.push({ id: 2, label: 'Borda', icon: Pizza });
    }
    if (product.allowHalfAndHalf && variants.length > 0) {
      steps.push({ id: 3, label: 'Metade', icon: Pizza });
    }
    if (
      (product.optionGroups && product.optionGroups.length > 0) ||
      (isPizza && dbAddons.length > 0)
    ) {
      steps.push({ id: 4, label: 'Adicionais', icon: Plus });
    }
    steps.push({ id: 5, label: 'Revisão', icon: Check });
    return steps;
  }, [variants, isPizza, dbCrusts, product.allowHalfAndHalf, product.optionGroups, dbAddons]);

  // Define o primeiro passo ativo ao abrir
  useEffect(() => {
    if (activeSteps.length > 0 && !activeSteps.some((s) => s.id === currentStep)) {
      setCurrentStep(activeSteps[0].id);
    }
  }, [activeSteps, currentStep]);

  // Variante selecionada atualmente
  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) || null;
  }, [variants, selectedVariantId]);

  // Encontra variante compatível em outro produto de pizza
  const findMatchingVariant = (targetProd, variant) => {
    if (!targetProd || !variant || !targetProd.variants) return null;
    return (
      targetProd.variants.find(
        (v) =>
          (v.code && variant.code && v.code === variant.code) ||
          v.name.trim().toLowerCase() === variant.name.trim().toLowerCase(),
      ) || null
    );
  };

  // Candidatos para a segunda metade (mesmo tamanho/grupo)
  const halfAndHalfCandidates = useMemo(() => {
    if (!product.allowHalfAndHalf || !selectedVariant) return [];
    const group = product.halfAndHalfGroup || product.category;

    return catalogProducts.filter((p) => {
      const pId = p.productId ?? p.id;
      const targetId = product.productId ?? product.id;
      if (pId === targetId) return false;
      if (p.isAvailable === false) return false;

      const sameGroup = (p.halfAndHalfGroup || p.category) === group;
      return Boolean(p.allowHalfAndHalf && sameGroup && findMatchingVariant(p, selectedVariant));
    });
  }, [catalogProducts, product, selectedVariant]);

  // Produto selecionado como segunda metade
  const selectedHalfProduct = useMemo(() => {
    if (!isHalfAndHalf) return null;
    return (
      halfAndHalfCandidates.find((p) => (p.productId ?? p.id) === selectedHalfProductId) ||
      halfAndHalfCandidates[0] ||
      null
    );
  }, [isHalfAndHalf, halfAndHalfCandidates, selectedHalfProductId]);

  // Variante da segunda metade
  const selectedHalfVariant = useMemo(() => {
    if (!selectedHalfProduct || !selectedVariant) return null;
    return findMatchingVariant(selectedHalfProduct, selectedVariant);
  }, [selectedHalfProduct, selectedVariant]);

  // Objeto estruturado do meia-a-meia
  const halfAndHalfData = useMemo(() => {
    if (!isHalfAndHalf || !selectedHalfProduct || !selectedHalfVariant) return null;
    return {
      firstProductId: product.productId ?? product.id,
      firstProductName: product.name,
      firstVariantId: selectedVariant?.id ?? null,
      firstVariantName: selectedVariant?.name ?? '',
      secondProductId: selectedHalfProduct.productId ?? selectedHalfProduct.id,
      secondProductName: selectedHalfProduct.name,
      secondVariantId: selectedHalfVariant.id,
      secondVariantName: selectedHalfVariant.name,
      priceRule: 'HIGHER_HALF_PRICE',
    };
  }, [isHalfAndHalf, selectedHalfProduct, selectedHalfVariant, product, selectedVariant]);

  // Lista de opções de borda compatíveis
  const availableCrusts = useMemo(() => {
    const list = [...dbCrusts];
    if (product.optionGroups) {
      for (const group of product.optionGroups) {
        if ((group.name || '').toLowerCase().includes('borda') && group.options) {
          list.push(...group.options);
        }
      }
    }
    return list.filter((c) => c.isAvailable !== false);
  }, [dbCrusts, product.optionGroups]);

  const selectedCrust = useMemo(() => {
    return availableCrusts.find((c) => c.id === selectedCrustId) || null;
  }, [availableCrusts, selectedCrustId]);

  // Lista de adicionais reais compatíveis
  const availableAddons = useMemo(() => {
    const list = [];
    if (product.optionGroups && product.optionGroups.length > 0) {
      for (const group of product.optionGroups) {
        if (!(group.name || '').toLowerCase().includes('borda') && group.options) {
          list.push(...group.options);
        }
      }
    } else if (isPizza) {
      list.push(...dbAddons);
    }
    return list.filter((a) => a.isAvailable !== false);
  }, [product.optionGroups, isPizza, dbAddons]);

  const selectedAddonsList = useMemo(() => {
    return availableAddons.filter((a) => selectedAddonIds.includes(a.id));
  }, [availableAddons, selectedAddonIds]);

  // Toggle de adicionais com respeito aos limites de grupo
  const toggleAddon = (addonId, group = null) => {
    setValidationError('');
    setSelectedAddonIds((prev) => {
      const isChecked = prev.includes(addonId);
      if (isChecked) {
        return prev.filter((id) => id !== addonId);
      }
      if (group && group.maxChoices === 1) {
        const groupOptionIds = (group.options || []).map((o) => o.id);
        const withoutGroup = prev.filter((id) => !groupOptionIds.includes(id));
        return [...withoutGroup, addonId];
      }
      if (group && group.maxChoices > 1) {
        const groupOptionIds = (group.options || []).map((o) => o.id);
        const currentInGroup = prev.filter((id) => groupOptionIds.includes(id));
        if (currentInGroup.length >= group.maxChoices) {
          setValidationError(
            `Máximo de ${group.maxChoices} seleções permitidas para "${group.name}".`,
          );
          return prev;
        }
      }
      return [...prev, addonId];
    });
  };

  // Cálculo de Preços
  const basePrice = useMemo(() => {
    const pPrice = Number(selectedVariant?.price ?? product.price ?? 0);
    if (halfAndHalfData) {
      const hPrice = Number(selectedHalfVariant?.price ?? selectedHalfProduct?.price ?? 0);
      return Math.max(pPrice, hPrice);
    }
    return pPrice;
  }, [selectedVariant, product.price, halfAndHalfData, selectedHalfVariant, selectedHalfProduct]);

  const crustPrice = useMemo(() => {
    return Number(selectedCrust?.price ?? 0);
  }, [selectedCrust]);

  const addonsPrice = useMemo(() => {
    return selectedAddonsList.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  }, [selectedAddonsList]);

  const totalPrice = useMemo(() => {
    return basePrice + crustPrice + addonsPrice;
  }, [basePrice, crustPrice, addonsPrice]);

  // Validação ao avançar
  const handleNextStep = () => {
    setValidationError('');
    if (currentStep === 1 && variants.length > 0 && !selectedVariantId) {
      setValidationError('Selecione um tamanho obrigatório para continuar.');
      return;
    }
    if (currentStep === 3 && isHalfAndHalf && !selectedHalfProduct) {
      setValidationError('Selecione o segundo sabor da pizza ou desmarque a opção meia-a-meia.');
      return;
    }
    if (currentStep === 4 && product.optionGroups) {
      for (const group of product.optionGroups) {
        if (group.isRequired && group.minChoices > 0) {
          const groupOptionIds = (group.options || []).map((o) => o.id);
          const count = selectedAddonIds.filter((id) => groupOptionIds.includes(id)).length;
          if (count < group.minChoices) {
            setValidationError(
              `O grupo "${group.name}" exige pelo menos ${group.minChoices} opção selecionada.`,
            );
            return;
          }
        }
      }
    }

    const currentIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex < activeSteps.length - 1) {
      setCurrentStep(activeSteps[currentIndex + 1].id);
    }
  };

  const handlePrevStep = () => {
    setValidationError('');
    const currentIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(activeSteps[currentIndex - 1].id);
    }
  };

  // Montar e Adicionar ao carrinho
  const handleConfirmAddToCart = () => {
    if (variants.length > 0 && !selectedVariant) {
      setValidationError('Selecione um tamanho antes de adicionar.');
      return;
    }
    if (isHalfAndHalf && !halfAndHalfData) {
      setValidationError('Selecione a segunda metade ou desmarque a opção Meia a Meia.');
      return;
    }

    // Validações de grupos obrigatórios
    if (product.optionGroups) {
      for (const group of product.optionGroups) {
        if (group.isRequired && group.minChoices > 0) {
          const groupOptionIds = (group.options || []).map((o) => o.id);
          const count = selectedAddonIds.filter((id) => groupOptionIds.includes(id)).length;
          if (count < group.minChoices) {
            setValidationError(
              `O grupo "${group.name}" exige pelo menos ${group.minChoices} escolha.`,
            );
            setCurrentStep(4);
            return;
          }
        }
      }
    }

    const optionIds = [...selectedAddonIds, selectedCrustId || null].filter(Boolean);

    const customizationsArr = [];
    if (selectedVariant) customizationsArr.push(`Tamanho: ${selectedVariant.name}`);
    if (selectedCrust)
      customizationsArr.push(
        `Borda: ${selectedCrust.name} (+${formatCurrency(selectedCrust.price)})`,
      );
    if (selectedAddonsList.length > 0) {
      customizationsArr.push(
        ...selectedAddonsList.map((a) => `${a.name} (+${formatCurrency(a.price)})`),
      );
    }
    const customizationsText = customizationsArr.join(' | ');

    const itemName = halfAndHalfData
      ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
      : product.name;

    const cartItemPayload = {
      productId: product.productId ?? product.id,
      name: itemName,
      displayName: itemName,
      basePrice,
      price: totalPrice,
      qty: 1,
      quantity: 1,
      category: product.category,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? '',
      crustId: selectedCrust?.id ?? null,
      crustName: selectedCrust?.name ?? '',
      addonIds: selectedAddonIds,
      addons: selectedAddonsList,
      optionIds,
      halfAndHalf: halfAndHalfData,
      image: product.image,
      imageUrl: product.imageUrl,
      customizations: customizationsText,
    };

    onAddToCart(cartItemPayload);
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Produto */}
        <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 text-3xl shadow-sm border border-slate-200 dark:border-slate-700">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{product.image || '🍕'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
              {product.name}
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
              {product.description ||
                'Personalize os detalhes do item antes de adicionar ao carrinho.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Indicador de Passos */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto no-scrollbar gap-1">
          {activeSteps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isDone = activeSteps.findIndex((s) => s.id === currentStep) > idx;
            const StepIcon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setValidationError('');
                  setCurrentStep(step.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition whitespace-nowrap ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : isDone
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <StepIcon size={14} className={isActive ? 'animate-pulse' : ''} />
                <span>{step.label}</span>
                {isDone && <Check size={12} className="text-red-600 dark:text-red-400 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Mensagem de Erro de Validação */}
        {validationError && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Conteúdo Dinâmico do Passo */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: TAMANHO */}
          {currentStep === 1 && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-baseline">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  1. Escolha o Tamanho
                </h3>
                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                  * Obrigatório
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setSelectedHalfProductId('');
                        setValidationError('');
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-red-600 bg-red-50/80 text-red-900 dark:bg-red-950/40 dark:border-red-500 dark:text-red-200 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-red-600 bg-red-600'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-black text-sm">{variant.name}</span>
                      </div>
                      <span className="font-black text-red-600 dark:text-red-400 text-sm">
                        {formatCurrency(variant.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: BORDA */}
          {currentStep === 2 && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-baseline">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  2. Escolha a Borda
                </h3>
                <span className="text-xs font-bold text-slate-400">Opcional</span>
              </div>
              <div className="space-y-2">
                <label
                  onClick={() => setSelectedCrustId('')}
                  className={`flex cursor-pointer items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                    !selectedCrustId
                      ? 'border-red-600 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="crust_option"
                      checked={!selectedCrustId}
                      onChange={() => setSelectedCrustId('')}
                      className="h-4 w-4 accent-red-600"
                    />
                    <span>Sem borda recheada</span>
                  </div>
                  <span className="text-xs font-black text-slate-500">R$ 0,00</span>
                </label>

                {availableCrusts.map((crust) => {
                  const isSelected = selectedCrustId === crust.id;
                  return (
                    <label
                      key={crust.id}
                      onClick={() => setSelectedCrustId(crust.id)}
                      className={`flex cursor-pointer items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-red-600 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="crust_option"
                          checked={isSelected}
                          onChange={() => setSelectedCrustId(crust.id)}
                          className="h-4 w-4 accent-red-600"
                        />
                        <span>{crust.name}</span>
                      </div>
                      <span className="text-sm font-black text-red-600 dark:text-red-400">
                        + {formatCurrency(crust.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: METADE */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-baseline">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  3. Pizza Meia a Meia (2 Sabores)
                </h3>
                <span className="text-xs font-bold text-slate-400">Opcional</span>
              </div>

              <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/40">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 font-black">
                      1/2
                    </div>
                    <div>
                      <span className="block text-sm font-black text-slate-900 dark:text-white">
                        Montar pizza dividida (Meia-Meia)
                      </span>
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        Regra de preço: cobra o valor da metade mais cara.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isHalfAndHalf}
                    onChange={(e) => {
                      setIsHalfAndHalf(e.target.checked);
                      if (!e.target.checked) setSelectedHalfProductId('');
                      setValidationError('');
                    }}
                    className="h-5 w-5 accent-red-600 rounded"
                  />
                </label>
              </div>

              {isHalfAndHalf && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-slate-500 uppercase">
                    Selecione o segundo sabor (
                    {selectedVariant ? selectedVariant.name : 'Tamanho selecionado'})
                  </h4>

                  {halfAndHalfCandidates.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 p-4 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2.5">
                      <Info size={18} className="shrink-0 text-amber-600" />
                      <span>
                        Não há outro sabor compatível cadastrado neste mesmo tamanho ou categoria.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                      {halfAndHalfCandidates.map((cand) => {
                        const candId = cand.productId ?? cand.id;
                        const candVariant = findMatchingVariant(cand, selectedVariant);
                        const candPrice = Number(candVariant?.price ?? cand.price ?? 0);
                        const isSelected = selectedHalfProductId === candId;
                        const isHigher =
                          candPrice > Number(selectedVariant?.price ?? product.price ?? 0);

                        return (
                          <button
                            key={candId}
                            type="button"
                            onClick={() => {
                              setSelectedHalfProductId(candId);
                              setValidationError('');
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition ${
                              isSelected
                                ? 'border-red-600 bg-red-50/90 text-red-950 dark:bg-red-950/40 dark:border-red-500 dark:text-red-200 shadow-sm font-bold'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-red-600 bg-red-600'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {isSelected && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                )}
                              </div>
                              <span className="font-bold text-sm truncate">{cand.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isHigher && (
                                <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 px-1.5 py-0.5 rounded font-black uppercase">
                                  Maior valor
                                </span>
                              )}
                              <span className="font-black text-slate-900 dark:text-white text-sm">
                                {formatCurrency(candPrice)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: ADICIONAIS */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-baseline">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  4. Ingredientes e Adicionais
                </h3>
                <span className="text-xs font-bold text-slate-400">Opcional</span>
              </div>

              {product.optionGroups && product.optionGroups.length > 0 ? (
                product.optionGroups
                  .filter((g) => !(g.name || '').toLowerCase().includes('borda'))
                  .map((group) => (
                    <div key={group.id} className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="font-black text-sm text-slate-800 dark:text-slate-200">
                          {group.name}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {group.isRequired ? (
                            <span className="text-red-600 dark:text-red-400 font-black">
                              * Mín. {group.minChoices}
                            </span>
                          ) : (
                            `Máx. ${group.maxChoices}`
                          )}
                        </span>
                      </div>
                      <div className="space-y-2 pl-1">
                        {(group.options || []).map((addon) => {
                          const isChecked = selectedAddonIds.includes(addon.id);
                          return (
                            <label
                              key={addon.id}
                              className={`flex cursor-pointer items-center justify-between p-3 rounded-xl border-2 transition ${
                                isChecked
                                  ? 'border-red-600 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-bold'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type={group.maxChoices === 1 ? 'radio' : 'checkbox'}
                                  name={`group_${group.id}`}
                                  checked={isChecked}
                                  onChange={() => toggleAddon(addon.id, group)}
                                  className="h-4 w-4 accent-red-600"
                                />
                                <span>{addon.name}</span>
                              </div>
                              <span className="font-black text-red-600 dark:text-red-400 text-sm">
                                + {formatCurrency(addon.price)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
              ) : availableAddons.length > 0 ? (
                <div className="space-y-2">
                  {availableAddons.map((addon) => {
                    const isChecked = selectedAddonIds.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={`flex cursor-pointer items-center justify-between p-3.5 rounded-xl border-2 transition ${
                          isChecked
                            ? 'border-red-600 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAddon(addon.id)}
                            className="h-4 w-4 accent-red-600"
                          />
                          <span>{addon.name}</span>
                        </div>
                        <span className="font-black text-red-600 dark:text-red-400 text-sm">
                          + {formatCurrency(addon.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-6 text-sm font-semibold text-slate-400">
                  Nenhum adicional disponível para este item.
                </p>
              )}
            </div>
          )}

          {/* STEP 5: REVISÃO */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                5. Resumo do Item
              </h3>

              <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 p-4 space-y-3">
                <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="font-black text-base text-slate-900 dark:text-white">
                      {halfAndHalfData
                        ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
                        : product.name}
                    </h4>
                    {selectedVariant && (
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-0.5">
                        Tamanho: {selectedVariant.name}
                      </p>
                    )}
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">
                    {formatCurrency(basePrice)}
                  </span>
                </div>

                {/* Detalhes Meia a Meia */}
                {halfAndHalfData && (
                  <div className="space-y-1.5 py-1 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex justify-between font-medium">
                      <span>• Metade 1: {halfAndHalfData.firstProductName}</span>
                      <span>{formatCurrency(selectedVariant?.price ?? product.price)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>• Metade 2: {halfAndHalfData.secondProductName}</span>
                      <span>
                        {formatCurrency(selectedHalfVariant?.price ?? selectedHalfProduct?.price)}
                      </span>
                    </div>
                    <div className="text-[11px] font-black text-amber-600 dark:text-amber-400 pt-1">
                      ⚠️ Cobrado o valor da metade de maior preço
                    </div>
                  </div>
                )}

                {/* Borda */}
                {selectedCrust && (
                  <div className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold">• Borda: {selectedCrust.name}</span>
                    <span className="font-black text-red-600 dark:text-red-400">
                      + {formatCurrency(selectedCrust.price)}
                    </span>
                  </div>
                )}

                {/* Adicionais */}
                {selectedAddonsList.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="block text-xs font-black text-slate-500 uppercase">
                      Adicionais selecionados:
                    </span>
                    {selectedAddonsList.map((a) => (
                      <div
                        key={a.id}
                        className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 pl-2"
                      >
                        <span>• {a.name}</span>
                        <span className="font-black text-red-600 dark:text-red-400">
                          + {formatCurrency(a.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Final */}
                <div className="flex items-center justify-between border-t-2 border-dashed border-slate-300 dark:border-slate-700 pt-3 text-lg font-black text-slate-900 dark:text-white">
                  <span>Total Calculado</span>
                  <span className="text-red-600 dark:text-red-400 text-xl">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé e Botões de Navegação */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total do item
            </span>
            <span className="text-lg font-black text-red-600 dark:text-red-400">
              {formatCurrency(totalPrice)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeSteps.findIndex((s) => s.id === currentStep) > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex items-center gap-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronLeft size={16} />
                <span>Voltar</span>
              </button>
            )}

            {currentStep !== 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-1 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-black text-xs transition shadow-md"
              >
                <span>Avançar</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmAddToCart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-black text-xs transition shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-95"
              >
                <ShoppingCart size={16} />
                <span>Adicionar ao carrinho</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
