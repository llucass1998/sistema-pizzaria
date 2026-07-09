import React, { useState } from 'react';
import { Store, User, Mail, Lock, CheckCircle2, ChevronRight, Globe, Loader2 } from 'lucide-react';
import pizzariaLogo from '../../assets/rio-pizzas-logo.png';
const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    storeName: '',
    slug: '',
    ownerName: '',
    email: '',
    password: '',
    plan: 'PRO',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSlugChange = (e) => {
    // Apenas letras minúsculas, números e hífens
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, slug: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/public/saas/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar loja.');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = `/?tenant=${data.tenant.slug}#/admin/login`;
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Loja Criada com Sucesso!</h2>
          <p className="text-slate-600 mb-8">
            Sua loja <strong>{formData.storeName}</strong> está pronta. Você será redirecionado para
            o painel de administração...
          </p>
          <div className="flex justify-center">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Esquerda: Marketing/Branding */}
      <div className="md:w-1/2 bg-gradient-to-br from-red-600 to-red-800 text-white p-8 md:p-12 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10 max-w-lg mx-auto">
          <img src={pizzariaLogo} alt="Logo" className="w-20 h-20 bg-white rounded-full p-2 mb-8" />
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">
            Venda mais com o melhor sistema de Delivery.
          </h1>
          <p className="text-red-100 text-lg mb-8">
            Tenha seu próprio site, painel administrativo, PDV de balcão e integração com KDS em
            menos de 1 minuto.
          </p>
          <ul className="space-y-4">
            {[
              'Sem comissões por venda',
              'Gestão completa de estoque',
              'Rotas de motoboy automatizadas',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-red-50 font-medium">
                <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Direita: Formulário */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-12 bg-white">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Crie sua conta agora</h2>
            <p className="text-slate-500 mt-1">Preencha os dados e ganhe 14 dias grátis.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Nome do Estabelecimento
              </label>
              <div className="relative">
                <Store
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  placeholder="Ex: Pizzaria do Mario"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Endereço da sua loja (Link)
              </label>
              <div className="relative flex">
                <div className="bg-slate-100 border border-slate-200 border-r-0 rounded-l-lg px-3 py-3 text-slate-500 text-sm flex items-center">
                  <Globe size={16} className="mr-1" /> .app.com/
                </div>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-r-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition font-mono"
                  placeholder="pizzariadomario"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Seu site ficará em: seudominio.app.com/?tenant={formData.slug || 'slug'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">Seu Nome</label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 transition"
                    placeholder="Mario Silva"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 transition"
                  placeholder="contato@pizzariadomario.com.br"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Senha Segura</label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Criar Minha Loja <ChevronRight size={20} />
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-500 mt-4">
              Ao criar sua conta você concorda com nossos{' '}
              <a href="#" className="text-red-600 hover:underline">
                Termos de Serviço
              </a>{' '}
              e{' '}
              <a href="#" className="text-red-600 hover:underline">
                Política de Privacidade
              </a>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
