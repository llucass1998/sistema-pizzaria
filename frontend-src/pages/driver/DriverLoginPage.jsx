import { useState } from 'react';
import { Bike, LockKeyhole, RefreshCw } from 'lucide-react';
import { loginDriver } from './driverApi.js';

export default function DriverLoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      setIsLoading(true);
      const session = await loginDriver(email, password);
      onLogin(session);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Erro ao entrar.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/30">
            <Bike size={28} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Motoboy</p>
            <h1 className="text-2xl font-black">Entrar nas entregas</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-black text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none transition focus:border-red-600 focus:bg-white"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-700">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none transition focus:border-red-600 focus:bg-white"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 text-base font-black text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700 disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <LockKeyhole size={20} />
            )}
            Acessar minhas entregas
          </button>
        </form>

        <a
          href="#/"
          className="mt-5 block text-center text-sm font-bold text-slate-500 hover:text-slate-950"
        >
          Voltar para a loja
        </a>
      </section>
    </main>
  );
}
