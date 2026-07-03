import { X } from 'lucide-react';

export function AuthModal({
  isOpen,
  authMode,
  email,
  password,
  registerName,
  authError,
  isAuthLoading,
  onClose,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onRegisterNameChange,
  onSubmit,
}) {
  if (!isOpen) return null;

  const isLogin = authMode === 'login';

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-lg border-2 border-slate-300 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[90dvh] sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-2xl font-bold text-red-600">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            type="button"
            aria-label="Fechar login"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Nome
              </label>
              <input
                type="text"
                value={registerName}
                onChange={(event) => onRegisterNameChange(event.target.value)}
                placeholder="Seu nome completo"
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="********"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {authError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={isAuthLoading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 font-bold text-white transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
          >
            {isAuthLoading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>

          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            {isLogin ? 'Nao tem conta?' : 'Ja tem conta?'}{' '}
            <button
              type="button"
              onClick={() => onModeChange(isLogin ? 'register' : 'login')}
              className="font-bold text-red-600 transition-colors duration-200 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:text-red-300"
            >
              {isLogin ? 'Cadastre-se' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
