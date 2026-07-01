import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, MapPin, Loader2 } from 'lucide-react';
import { Alert, Field, Panel, PanelHeader } from '../../components/admin/AdminUI.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function getAdminToken() {
  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  return adminDataStr ? JSON.parse(adminDataStr).token : null;
}

export function DeliverySettings({ deliveryFeeMode, onModeChange }) {
  const [zones, setZones] = useState([]);
  const [radiusRules, setRadiusRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [newZone, setNewZone] = useState({ name: '', fee: '', minOrderValue: '' });
  const [newRadius, setNewRadius] = useState({ maxKm: '', fee: '', minOrderValue: '' });

  useEffect(() => {
    fetchDeliveryData();
  }, []);

  async function fetchDeliveryData() {
    setIsLoading(true);
    try {
      const [zonesRes, rulesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/delivery-zones`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        }),
        fetch(`${API_BASE_URL}/admin/delivery-radius-rules`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        }),
      ]);
      
      if (zonesRes.ok) setZones(await zonesRes.json());
      if (rulesRes.ok) setRadiusRules(await rulesRes.json());
    } catch (err) {
      setError('Erro ao carregar configuracoes de entrega.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddZone(e) {
    e.preventDefault();
    setError('');
    if (!newZone.name || !newZone.fee) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/delivery-zones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          name: newZone.name,
          fee: Number(newZone.fee),
          minOrderValue: newZone.minOrderValue ? Number(newZone.minOrderValue) : null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const zone = await res.json();
      setZones([...zones, zone]);
      setNewZone({ name: '', fee: '', minOrderValue: '' });
    } catch (err) {
      setError('Erro ao adicionar bairro: ' + err.message);
    }
  }

  async function handleDeleteZone(id) {
    try {
      await fetch(`${API_BASE_URL}/admin/delivery-zones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      setZones(zones.filter((z) => z.id !== id));
    } catch (err) {
      setError('Erro ao remover bairro.');
    }
  }

  async function handleAddRadius(e) {
    e.preventDefault();
    setError('');
    if (!newRadius.maxKm || !newRadius.fee) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/delivery-radius-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          maxKm: Number(newRadius.maxKm),
          fee: Number(newRadius.fee),
          minOrderValue: newRadius.minOrderValue ? Number(newRadius.minOrderValue) : null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const rule = await res.json();
      setRadiusRules([...radiusRules, rule].sort((a, b) => a.maxKm - b.maxKm));
      setNewRadius({ maxKm: '', fee: '', minOrderValue: '' });
    } catch (err) {
      setError('Erro ao adicionar raio: ' + err.message);
    }
  }

  async function handleDeleteRadius(id) {
    try {
      await fetch(`${API_BASE_URL}/admin/delivery-radius-rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      setRadiusRules(radiusRules.filter((r) => r.id !== id));
    } catch (err) {
      setError('Erro ao remover regra de raio.');
    }
  }

  return (
    <Panel className="mt-8">
      <PanelHeader
        title="Regras e Zonas de Entrega"
        description="Como as taxas de entrega sao calculadas para o cliente."
        Icon={MapPin}
      />
      <div className="p-5">

        
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <label className="block text-sm font-black text-slate-900 dark:text-slate-100 mb-2">
            Metodo de Calculo da Entrega
          </label>
          <select
            className="w-full sm:w-1/2 rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={deliveryFeeMode}
            onChange={(e) => onModeChange(e.target.value)}
          >
            <option value="FIXED">Taxa Fixa Unica (Padrao)</option>
            <option value="NEIGHBORHOOD">Por Bairros (Lista de bairros atendidos)</option>
            <option value="DISTANCE">Por Distancia (Raio em Km) - Requer API de Mapas</option>
          </select>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {deliveryFeeMode === 'FIXED' && 'A taxa fixa unica pode ser alterada no painel principal acima.'}
            {deliveryFeeMode === 'NEIGHBORHOOD' && 'Adicione os bairros abaixo. Bairros nao listados serao recusados no checkout.'}
            {deliveryFeeMode === 'DISTANCE' && 'Adicione faixas de quilometragem. Ex: Ate 3km = R$5, Ate 5km = R$10.'}
          </p>
        </div>

        {deliveryFeeMode === 'NEIGHBORHOOD' && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Gerenciar Bairros</h3>
            <form onSubmit={handleAddZone} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Field label="Nome do Bairro" value={newZone.name} onChange={(v) => setNewZone({...newZone, name: v})} placeholder="Ex: Copacabana" />
              </div>
              <div className="w-32">
                <Field label="Taxa (R$)" type="number" value={newZone.fee} onChange={(v) => setNewZone({...newZone, fee: v})} placeholder="5.00" />
              </div>
              <div className="w-32">
                <Field label="Pedido Minimo (R$)" type="number" value={newZone.minOrderValue} onChange={(v) => setNewZone({...newZone, minOrderValue: v})} placeholder="Opcional" />
              </div>
              <button type="submit" className="h-11 px-4 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white mb-2">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/50">
                  <tr>
                    <th className="p-3">Bairro</th>
                    <th className="p-3">Taxa</th>
                    <th className="p-3">Pedido Minimo</th>
                    <th className="p-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {zones.map((z) => (
                    <tr key={z.id}>
                      <td className="p-3 font-medium">{z.name}</td>
                      <td className="p-3">R$ {Number(z.fee).toFixed(2)}</td>
                      <td className="p-3">{z.minOrderValue ? `R$ ${Number(z.minOrderValue).toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteZone(z.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {zones.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center">Nenhum bairro cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {deliveryFeeMode === 'DISTANCE' && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Gerenciar Raios de Entrega</h3>
            <form onSubmit={handleAddRadius} className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Field label="Ate (Km)" type="number" value={newRadius.maxKm} onChange={(v) => setNewRadius({...newRadius, maxKm: v})} placeholder="Ex: 5" />
              </div>
              <div className="w-32">
                <Field label="Taxa (R$)" type="number" value={newRadius.fee} onChange={(v) => setNewRadius({...newRadius, fee: v})} placeholder="5.00" />
              </div>
              <div className="w-32">
                <Field label="Pedido Minimo (R$)" type="number" value={newRadius.minOrderValue} onChange={(v) => setNewRadius({...newRadius, minOrderValue: v})} placeholder="Opcional" />
              </div>
              <button type="submit" className="h-11 px-4 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white mb-2">
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/50">
                  <tr>
                    <th className="p-3">Ate Km</th>
                    <th className="p-3">Taxa</th>
                    <th className="p-3">Pedido Minimo</th>
                    <th className="p-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {radiusRules.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-medium">Ate {Number(r.maxKm).toFixed(1)} km</td>
                      <td className="p-3">R$ {Number(r.fee).toFixed(2)}</td>
                      <td className="p-3">{r.minOrderValue ? `R$ ${Number(r.minOrderValue).toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteRadius(r.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {radiusRules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center">Nenhuma regra cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </Panel>
  );
}
