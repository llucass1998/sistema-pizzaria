const fs = require('fs');
let content = fs.readFileSync('frontend-src/pages/admin/SettingsPage.jsx', 'utf8');

content = content.replace(
  'isOpen: data.isOpen ?? true,',
  `isOpen: data.isOpen ?? true,
    notifyNewOrderWhatsApp: data.notifyNewOrderWhatsApp ?? false,
    notifyLowStockWhatsApp: data.notifyLowStockWhatsApp ?? false,
    notifyDeliveryDoneWhatsApp: data.notifyDeliveryDoneWhatsApp ?? false,
    notificationWhatsAppNumber: data.notificationWhatsAppNumber ?? '',`
);

content = content.replace(
  'const [form, setForm] = useState(null);',
  `const [form, setForm] = useState(null);\n  const [activeTab, setActiveTab] = useState('LOJA');`
);

content = content.replace(
  '<div className="mb-8">\n        <h2 className="text-xl font-black text-slate-900 dark:text-white">\n          Configuracoes da Loja\n        </h2>\n        <p className="text-sm text-slate-500">Dados publicos, identidade visual, taxas e horarios.</p>\n      </div>',
  `<div className="mb-8">\n        <h2 className="text-xl font-black text-slate-900 dark:text-white">\n          Configurações da Loja\n        </h2>\n        <p className="text-sm text-slate-500">Gerencie todos os aspectos do seu sistema.</p>\n      </div>\n\n      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">\n        <button onClick={() => setActiveTab('LOJA')} className={\`px-4 py-2 font-bold rounded-lg whitespace-nowrap \${activeTab === 'LOJA' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>Loja</button>\n        <button onClick={() => setActiveTab('VISUAL')} className={\`px-4 py-2 font-bold rounded-lg whitespace-nowrap \${activeTab === 'VISUAL' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>Visual</button>\n        <button onClick={() => setActiveTab('ENTREGA')} className={\`px-4 py-2 font-bold rounded-lg whitespace-nowrap \${activeTab === 'ENTREGA' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>Entrega e Taxas</button>\n        <button onClick={() => setActiveTab('FIDELIDADE')} className={\`px-4 py-2 font-bold rounded-lg whitespace-nowrap \${activeTab === 'FIDELIDADE' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>Fidelidade</button>\n        <button onClick={() => setActiveTab('NOTIFICACOES')} className={\`px-4 py-2 font-bold rounded-lg whitespace-nowrap \${activeTab === 'NOTIFICACOES' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>Notificações (WhatsApp)</button>\n      </div>`
);

content = content.replace(
  '<Panel>\n        <PanelHeader\n          title="Geral e Integracoes"\n          description="Ajuste os dados que aparecem para seus clientes."\n          Icon={Settings}\n        />\n        <form onSubmit={saveSettings} className="grid gap-4 p-5 md:grid-cols-2">',
  `<Panel>\n        <form onSubmit={saveSettings} className="p-5">\n          {/* ABA LOJA */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'LOJA' ? '' : 'hidden'}\`}>`
);

content = content.replace(
  '<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">\n              <div>\n                <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">\n                  <Palette className="h-4 w-4 text-red-600" />\n                  Identidade Visual',
  `</div>\n\n          {/* ABA VISUAL */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'VISUAL' ? '' : 'hidden'}\`}>\n          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">\n              <div>\n                <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">\n                  <Palette className="h-4 w-4 text-red-600" />\n                  Identidade Visual`
);

content = content.replace(
  '<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">\n              <Star className="h-4 w-4 text-amber-500" />\n              Mais pedido da noite',
  `</div>\n\n          {/* CONTINUAÇÃO ABA LOJA */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'LOJA' ? '' : 'hidden'}\`}>\n          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">\n              <Star className="h-4 w-4 text-amber-500" />\n              Mais pedido da noite`
);

content = content.replace(
  '<Field\n            label="Taxa de entrega (R$)"',
  `</div>\n\n          {/* ABA ENTREGA E TAXAS */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'ENTREGA' ? '' : 'hidden'}\`}>\n            <Field\n            label="Taxa de entrega (R$)"`
);

content = content.replace(
  '<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">\n              Modo Manutenção',
  `</div>\n\n          {/* CONTINUAÇÃO ABA LOJA - MANUTENÇÃO */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'LOJA' ? '' : 'hidden'}\`}>\n          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">\n              Modo Manutenção`
);

content = content.replace(
  '<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">\n              Programa de Fidelidade (CRM)',
  `</div>\n\n          {/* ABA FIDELIDADE */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'FIDELIDADE' ? '' : 'hidden'}\`}>\n          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">\n              Programa de Fidelidade (CRM)`
);

content = content.replace(
  '          <div className="pt-2 md:col-span-2">\n            <button',
  `</div>\n\n          {/* ABA NOTIFICAÇÕES WHATSAPP */}\n          <div className={\`grid gap-4 md:grid-cols-2 \${activeTab === 'NOTIFICACOES' ? '' : 'hidden'}\`}>\n            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">\n              <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">\n                Notificações via WhatsApp\n              </h3>\n              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Configure alertas automáticos para você (loja) ou clientes.</p>\n              \n              <Field\n                label="Número WhatsApp p/ Alertas (Admin)"\n                value={form.notificationWhatsAppNumber}\n                onChange={(value) => updateField('notificationWhatsAppNumber', value)}\n                placeholder="Ex: 5511999999999"\n                className="mb-4"\n              />\n\n              <div className="space-y-4">\n                <label className="flex items-center gap-3">\n                  <input type="checkbox" checked={form.notifyNewOrderWhatsApp} onChange={e => updateField('notifyNewOrderWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />\n                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receber alerta de novo pedido no painel</span>\n                </label>\n                <label className="flex items-center gap-3">\n                  <input type="checkbox" checked={form.notifyLowStockWhatsApp} onChange={e => updateField('notifyLowStockWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />\n                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receber alerta de estoque crítico (Insumos)</span>\n                </label>\n                <label className="flex items-center gap-3">\n                  <input type="checkbox" checked={form.notifyDeliveryDoneWhatsApp} onChange={e => updateField('notifyDeliveryDoneWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />\n                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificar cliente quando o pedido for entregue</span>\n                </label>\n              </div>\n            </div>\n          </div>\n\n          <div className="pt-6 border-t mt-6 border-slate-200 dark:border-slate-800 md:col-span-2 flex justify-end">\n            <button`
);

content = content.replace(
  '<DeliverySettings\n        deliveryFeeMode={form.deliveryFeeMode || \'FIXED\'}\n        onModeChange={(mode) => {\n          updateField(\'deliveryFeeMode\', mode);\n          // Auto-save the mode if possible, but the user has to click save anyway\n          // Wait, they have to click \'Salvar configuracoes\' above to save. \n          // So just updating the field is enough.\n        }}\n      />',
  `<div className={\`\${activeTab === 'ENTREGA' ? 'mt-6 block' : 'hidden'}\`}>\n      <DeliverySettings\n        deliveryFeeMode={form.deliveryFeeMode || 'FIXED'}\n        onModeChange={(mode) => {\n          updateField('deliveryFeeMode', mode);\n        }}\n      />\n      </div>`
);

fs.writeFileSync('frontend-src/pages/admin/SettingsPage.jsx', content);
console.log('SettingsPage updated.');
