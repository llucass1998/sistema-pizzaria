import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Bike, LogOut, RefreshCw } from 'lucide-react';
import DriverLoginPage from './DriverLoginPage.jsx';
import { clearDriverSession, getDriverMe, getDriverSession, isDriverSession } from './driverApi.js';

export default function DriverLayout() {
  const [session, setSession] = useState(getDriverSession);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  async function loadProfile() {
    if (!isDriverSession()) {
      setIsLoading(false);
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      setProfile(await getDriverMe());
    } catch (profileError) {
      setError(
        profileError instanceof Error ? profileError.message : 'Erro ao carregar entregador.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [session?.token]);

  function handleLogin(nextSession) {
    setSession(nextSession);
  }

  function handleLogout() {
    clearDriverSession();
    setSession(null);
    setProfile(null);
    navigate('/motoboy', { replace: true });
  }

  if (!session?.token) {
    return <DriverLoginPage onLogin={handleLogin} />;
  }

  if (!isDriverSession(session)) {
    return <Navigate to="/admin/login" replace />;
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-white/70">
          <RefreshCw size={22} className="animate-spin" />
          Carregando entregas
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-950 shadow-2xl">
          <h1 className="text-xl font-black">Acesso do entregador</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">{error}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Sair e tentar novamente
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <a href="#/motoboy" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/30">
              <Bike size={23} />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.2em] text-red-300">
                Motoboy
              </span>
              <span className="block text-base font-black leading-tight">
                {profile?.driver?.name || 'Entregas'}
              </span>
            </span>
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5 pb-24">
        <Outlet context={{ profile, reloadProfile: loadProfile }} />
      </div>
    </main>
  );
}
