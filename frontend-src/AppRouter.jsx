import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import CartPage from './pages/CartPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import MockPaymentPage from './pages/MockPaymentPage.jsx';
import KitchenDisplay from './pages/KDS/KitchenDisplay.jsx';

/**
 * Exemplo de configuracao de roteamento oficial.
 * Devera substituir o if/else gigante que existe hoje no App.jsx.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />

        {/* Rotas Administrativas */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/kds" element={<KitchenDisplay />} />

        {/* Mock Payment */}
        <Route path="/mock-payment" element={<MockPaymentPage />} />

        {/* Catch-all para redirecionar de volta para a Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
