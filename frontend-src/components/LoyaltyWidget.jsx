import { Award, CreditCard, Gift, Star } from 'lucide-react';
import { formatCurrency } from '../data/menuData.js';

export function LoyaltyWidget({ loyaltyBalance = 0, mode = 'CASHBACK', conversionRate = 10 }) {
  if (mode === 'CASHBACK') {
    return (
      <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 p-5 shadow-sm border border-green-200 sm:items-end transition-all hover:shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={18} className="text-green-700" />
          <span className="text-sm font-bold text-green-800 uppercase tracking-wider">
            Meu Cashback
          </span>
        </div>
        <span className="text-4xl font-black text-green-700 drop-shadow-sm">
          {formatCurrency(loyaltyBalance)}
        </span>
        <span className="text-xs font-semibold text-green-600 mt-2 bg-green-200/50 px-2 py-1 rounded-full">
          Disponível no Checkout
        </span>
      </div>
    );
  }

  // STAMPS (PIZZA SLICES) MODE
  const totalSlices = 8;
  const currentSlices = Math.floor(loyaltyBalance / conversionRate);
  const remaining = totalSlices - (currentSlices % totalSlices);
  const slicesToRender = currentSlices % totalSlices;

  return (
    <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-5 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} className="text-red-600" />
        <span className="text-sm font-bold text-orange-800 uppercase tracking-wider">
          Cartão Fidelidade
        </span>
      </div>

      <div className="relative w-24 h-24 mb-3">
        {/* SVG Pizza circular chart */}
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 drop-shadow-md">
          {Array.from({ length: totalSlices }).map((_, i) => {
            const angle = 360 / totalSlices;
            const startAngle = i * angle;
            const endAngle = (i + 1) * angle;

            // Calculando as coordenadas do path do arco SVG
            const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
            const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
            const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
            const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);

            const isFilled = i < slicesToRender;

            return (
              <path
                key={i}
                d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                fill={isFilled ? '#f97316' : '#ffedd5'}
                stroke="#fff"
                strokeWidth="2"
                className="transition-colors duration-500"
              />
            );
          })}
          {/* Inner circle to make it look like a crust/pizza */}
          <circle cx="50" cy="50" r="15" fill="#fff" />
        </svg>

        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Star
            size={16}
            className={slicesToRender > 0 ? 'text-red-500' : 'text-slate-200'}
            fill={slicesToRender > 0 ? 'currentColor' : 'none'}
          />
        </div>
      </div>

      {slicesToRender === 0 && currentSlices > 0 ? (
        <div className="text-center">
          <p className="text-sm font-black text-red-600 flex items-center justify-center gap-1">
            <Gift size={16} /> Você ganhou uma pizza!
          </p>
          <p className="text-xs text-orange-800 mt-1">Resgate no checkout.</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-bold text-orange-800">
            {slicesToRender} de {totalSlices} pedidos
          </p>
          <p className="text-xs text-red-600 mt-1">
            Falta{remaining > 1 ? 'm' : ''} {remaining} pedido{remaining > 1 ? 's' : ''} para uma
            pizza grátis!
          </p>
        </div>
      )}
    </div>
  );
}
