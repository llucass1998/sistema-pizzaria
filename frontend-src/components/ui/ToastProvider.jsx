import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    setToast({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((current) => {
          if (current?.message === message && current?.type === type) {
            return null;
          }
          return current;
        });
      }, duration);
    }
  }, []);

  const showSuccess = useCallback((message) => {
    showToast(message || 'Operação realizada com sucesso.', 'success');
  }, [showToast]);

  const showError = useCallback((message) => {
    showToast(message || 'Não foi possível concluir a operação.', 'error');
  }, [showToast]);
  
  const showInfo = useCallback((message) => {
    showToast(message || 'Informação', 'info');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      
      {/* Toast Overlay / Container */}
      {toast && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto" onClick={hideToast} />
          <div className={`relative flex max-w-md w-full items-center gap-3 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] pointer-events-auto transition-all duration-300 ease-out transform scale-100 opacity-100 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/95 border-2 border-emerald-200 dark:border-emerald-800' 
              : toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/95 border-2 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/95 border-2 border-blue-200 dark:border-blue-800'
          }`}>
            <div className={`shrink-0 ${
              toast.type === 'success' ? 'text-emerald-500' : toast.type === 'error' ? 'text-red-500' : 'text-blue-500'
            }`}>
              {toast.type === 'success' && <CheckCircle2 size={32} />}
              {toast.type === 'error' && <AlertCircle size={32} />}
              {toast.type === 'info' && <Info size={32} />}
            </div>
            
            <div className="flex-1 pr-4">
              <p className={`text-base font-black ${
                toast.type === 'success' ? 'text-emerald-800 dark:text-emerald-200' : toast.type === 'error' ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'
              }`}>
                {toast.message}
              </p>
            </div>
            
            <button
              onClick={hideToast}
              className={`absolute top-2 right-2 p-1.5 rounded-lg transition-colors ${
                toast.type === 'success' ? 'text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50' : toast.type === 'error' ? 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50' : 'text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
