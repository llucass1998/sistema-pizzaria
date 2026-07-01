import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { getWhatsappLink } from '../../data/menuData.js';

export function FloatingWhatsApp({ store }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!store?.whatsappNumber) return null;
  
  const whatsappLink = getWhatsappLink(store);

  return (
    <div className="fixed bottom-[84px] left-4 sm:bottom-6 sm:left-6 z-[60] flex flex-col items-start gap-3">
      {isOpen && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-72 overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-[#075E54] p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <MessageCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Atendimento</h4>
                <p className="text-xs text-white/80">{store.name || 'Loja'}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-opacity-5">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg rounded-tl-none shadow-sm text-sm text-slate-800 dark:text-slate-200 inline-block max-w-[90%] mb-2">
              Olá! Tem alguma dúvida? Solicite atendimento por aqui.
            </div>
            <div className="mt-4 text-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2.5 px-4 rounded-full shadow-md transition-colors"
              >
                <MessageCircle size={18} />
                Iniciar conversa
              </a>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#25D366]/30"
        aria-label="Atendimento via WhatsApp"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
}
