import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createWallet } from '../api/wallets.api.js';
import { CURRENCIES } from '../utils/transactions.js';
import { Alert, Button } from './ui.jsx';

/** One button per currency the user does not have a wallet in yet. */
export default function CreateWalletButtons({ existingCurrencies, onCreated }) {
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState('');
  const missing = CURRENCIES.filter((currency) => !existingCurrencies.includes(currency));

  const create = async (currency) => {
    setCreating(currency);
    setError('');
    try {
      await createWallet(currency);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(null);
    }
  };

  if (missing.length === 0) return null;
  return (
    <div className="stack">
      <Alert>{error}</Alert>
      <div className="row gap">
        {missing.map((currency) => (
          <Button key={currency} variant="secondary" loading={creating === currency} onClick={() => create(currency)}>
            <Plus size={16} /> Create {currency} wallet
          </Button>
        ))}
      </div>
    </div>
  );
}
