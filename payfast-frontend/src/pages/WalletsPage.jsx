import { useWallets } from '../hooks/useWallets.js';
import { LoadState, Skeleton } from '../components/ui.jsx';
import CreateWalletButtons from '../components/CreateWalletButtons.jsx';
import WalletCard from '../components/WalletCard.jsx';

export default function WalletsPage() {
  const wallets = useWallets();

  return (
    <div className="stack-lg">
      <div>
        <h2 className="greeting">Your wallets</h2>
        <p className="muted">You can hold one wallet per currency. Share a wallet reference to receive transfers.</p>
      </div>
      <LoadState loading={wallets.loading} error={wallets.error} onRetry={wallets.reload} hasData={!!wallets.data}
        fallback={<Skeleton height={190} radius={20} />}>
        <div className="grid">
          {wallets.data?.map((wallet) => <WalletCard key={wallet._id} wallet={wallet} />)}
        </div>
        {wallets.data && (
          <CreateWalletButtons existingCurrencies={wallets.data.map((wallet) => wallet.currency)} onCreated={wallets.reload} />
        )}
      </LoadState>
    </div>
  );
}
