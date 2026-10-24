import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { formatMoney } from '../utils/money.js';
import { CopyButton } from './ui.jsx';

export default function WalletCard({ wallet, detailsLink = true }) {
  const [hidden, setHidden] = useState(false);
  const inactive = wallet.status !== 'active';

  return (
    <div className={`wallet-card wallet-${wallet.currency}`}>
      <div className="row between">
        <span className="wallet-tag">{wallet.currency} wallet{inactive && ` - ${wallet.status}`}</span>
        <button className="wallet-eye" onClick={() => setHidden((value) => !value)} aria-label={hidden ? 'Show balance' : 'Hide balance'}>
          {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <p className="wallet-balance">{hidden ? `${wallet.currency} ****` : formatMoney(wallet.balance, wallet.currency)}</p>

      <div className="wallet-ref">
        <span>{wallet.reference}</span>
        <CopyButton text={wallet.reference} />
      </div>

      <div className="wallet-actions">
        <Link to={`/wallets/${wallet._id}/deposit`}><ArrowDownLeft size={16} /> Deposit</Link>
        <Link to={`/wallets/${wallet._id}/withdraw`}><ArrowUpRight size={16} /> Withdraw</Link>
        <Link to={`/transfer?from=${wallet._id}`}><ArrowLeftRight size={16} /> Send</Link>
        {detailsLink && <Link to={`/wallets/${wallet._id}`}>Details</Link>}
      </div>
    </div>
  );
}
