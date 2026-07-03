import { ChevronUp, MapPin, Phone, MessageCircle, Clock, CreditCard, Instagram } from 'lucide-react';
import { getMapsLink, getWhatsappLink, formatPhoneBR } from '../../data/menuData.js';

export function PublicFooter({ store, navbarColor }) {
  const mapsLink = getMapsLink(store);
  const whatsappLink = getWhatsappLink(store);
  const phoneNumber = formatPhoneBR(store?.phone);
  const whatsappFormatted = formatPhoneBR(store?.whatsappNumber);
  const instagramUrl = store?.instagramUrl || store?.socialInstagram;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Payment methods mock checks
  const hasPix = true;
  const hasCard = true;
  const hasCash = true;

  const isOpen = store?.isOpen !== false;

  return (
    <footer className="mt-16 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
      <div className="mx-auto w-full max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Logo e Nome */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-3 mb-4">
              {store?.logoUrl ? (
                <img src={store.logoUrl} alt={store?.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-300 dark:bg-slate-800 flex items-center justify-center text-xl">🍕</div>
              )}
              <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase">{store?.name || 'Pizzaria'}</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Pizzas artesanais, massa leve e recheio caprichado. Peça online e receba rápido no conforto da sua casa.
            </p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></span>
              {isOpen ? 'Aberto para pedidos' : 'Fechado no momento'}
            </div>
          </div>

          {/* Atendimento */}
          <div className="flex flex-col">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider text-sm">Atendimento</h4>
            <div className="space-y-3 text-sm">
              {whatsappFormatted && (
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  <MessageCircle size={16} />
                  <span>{whatsappFormatted}</span>
                </a>
              )}
              {phoneNumber && (
                <a href={`tel:${store?.phone}`} className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition">
                  <Phone size={16} />
                  <span>{phoneNumber}</span>
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram da loja" className="flex items-center gap-2 hover:text-pink-600 dark:hover:text-pink-400 transition">
                  <Instagram size={16} />
                  <span>Instagram</span>
                </a>
              )}
            </div>
          </div>

          {/* Localização e Horário */}
          <div className="flex flex-col">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider text-sm">Localização e Horário</h4>
            <div className="space-y-4 text-sm">
              {store?.address && (
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="mb-1">{store.address}</p>
                    <a href={mapsLink} target="_blank" rel="noreferrer" className="text-red-600 dark:text-red-400 font-bold hover:underline">
                      Como chegar?
                    </a>
                  </div>
                </div>
              )}
              {store?.hours && (
                <div className="flex items-start gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0" />
                  <p>{store.hours}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pagamento e Links */}
          <div className="flex flex-col">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider text-sm">Formas de pagamento</h4>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                <span>Cartões de Crédito e Débito</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">PIX</span>
                <span>Transferência rápida</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">$</span>
                <span>Dinheiro (com troco)</span>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} {store?.name || 'Pizzaria'}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={scrollToTop}
              className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              Voltar ao topo
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <ChevronUp size={16} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
