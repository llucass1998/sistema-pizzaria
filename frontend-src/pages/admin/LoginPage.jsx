import { useState } from 'react';
import { ShieldCheck, RefreshCw, ArrowLeft, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? '/api');

export function LoginPage({ isDarkMode = false, onToggleTheme = () => {} }) {
  const [email, setEmail] = useState('admin@riopizzas.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();
    setError('');

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Email ou senha invalidos.');
      }

      window.localStorage.setItem(
        'pizzaria-admin',
        JSON.stringify({
          admin: data.admin,
          token: data.token,
          role: data.role,
        }),
      );

      navigate(data.role === 'DRIVER' ? '/motoboy' : '/admin/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Erro ao entrar.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 transition-colors dark:bg-slate-950">
      <button
        type="button"
        onClick={onToggleTheme}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        title={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
        aria-label={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
              Painel administrativo
            </p>
            <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">
              Entrar no SaaS
            </h1>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-slate-950 dark:focus:border-slate-700"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-slate-950 dark:focus:border-slate-700"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {isLoading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <ShieldCheck size={18} />
            )}
            Entrar
          </button>
        </form>

        <a
          href="#/"
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
        >
          <ArrowLeft size={16} />
          Voltar ao cardápio
        </a>
      </section>
    </main>
  );
}
