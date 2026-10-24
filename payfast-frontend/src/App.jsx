import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { SkeletonBlock } from './components/ui.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WalletMoneyPage from './pages/WalletMoneyPage.jsx';
import TransferPage from './pages/TransferPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import TransactionDetailPage from './pages/TransactionDetailPage.jsx';
import WalletsPage from './pages/WalletsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AdminRoute from './components/AdminRoute.jsx';

// Pages that draw charts are loaded on demand to keep the first load small.
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const WalletDetailPage = lazy(() => import('./pages/WalletDetailPage.jsx'));
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage.jsx'));
const AdminTransactionsPage = lazy(() => import('./pages/AdminTransactionsPage.jsx'));
const AdminTransactionDetailPage = lazy(() => import('./pages/AdminTransactionDetailPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="boot"><SkeletonBlock /></div>}>
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="wallets" element={<WalletsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="wallets/:walletId" element={<WalletDetailPage />} />
        <Route path="wallets/:walletId/deposit" element={<WalletMoneyPage kind="deposit" />} />
        <Route path="wallets/:walletId/withdraw" element={<WalletMoneyPage kind="withdraw" />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/:reference" element={<TransactionDetailPage />} />
        <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="transactions/:reference" element={<AdminTransactionDetailPage />} />
          </Route>
        </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
