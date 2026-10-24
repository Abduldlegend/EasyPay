import { ArrowLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import { deposit, withdraw } from '../api/transactions.api.js';
import { getWallet } from '../api/wallets.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Alert, Button, Field, LoadState } from '../components/ui.jsx';
import TransactionResult from '../components/TransactionResult.jsx';
import { applyServerErrors, isOutcomeUnknown } from '../utils/errors.js';
import { newIdempotencyKey } from '../utils/idempotency.js';
import { formatMoney, MAX_AMOUNT_MINOR, toMinorUnits } from '../utils/money.js';

const KINDS = {
  deposit: { title: 'Deposit', submit: deposit, button: 'Deposit' },
  withdraw: { title: 'Withdrawal', submit: withdraw, button: 'Withdraw' },
};

const schema = z.object({
  amount: z.string().trim().min(1, 'Enter an amount'),
  description: z.string().trim().max(140, 'Description must be 140 characters or less').optional(),
});

function MoneyForm({ wallet, kind }) {
  const config = KINDS[kind];
  const idempotencyKey = useRef(newIdempotencyKey());
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values) => {
    setFormError('');
    const amount = toMinorUnits(values.amount);

    if (amount === null || amount <= 0) {
      return setError('amount', { message: 'Enter a valid amount (up to 2 decimal places)' });
    }
    if (amount > MAX_AMOUNT_MINOR) {
      return setError('amount', { message: `Maximum is ${formatMoney(MAX_AMOUNT_MINOR, wallet.currency)} per transaction` });
    }
    if (kind === 'withdraw' && amount > wallet.balance) {
      return setError('amount', { message: 'Amount is more than your available balance' });
    }

    try {
      const { transaction } = await config.submit({
        walletId: wallet._id,
        amount,
        description: values.description || undefined,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = newIdempotencyKey();
      setResult(transaction);
    } catch (error) {
      // If we cannot tell whether it went through, keep the key so a retry is safe.
      if (isOutcomeUnknown(error)) {
        setFormError(`${error.message} If you try again you will not be charged twice.`);
      } else {
        idempotencyKey.current = newIdempotencyKey();
        if (!applyServerErrors(error, setError, ['amount', 'description'])) setFormError(error.message);
      }
    }
  };

  if (result) {
    return (
      <TransactionResult
        transaction={result}
        title={config.title}
        onAnother={() => { setResult(null); reset(); }}
      />
    );
  }

  const inactive = wallet.status !== 'active';
  return (
    <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      {inactive && <Alert>This wallet is {wallet.status} and cannot be used for transactions.</Alert>}
      <Alert>{formError}</Alert>
      <Field label={`Amount (${wallet.currency})`} inputMode="decimal" placeholder="0.00" error={errors.amount?.message}
        hint={kind === 'withdraw' ? `Available: ${formatMoney(wallet.balance, wallet.currency)}` : undefined}
        {...register('amount')} />
      <Field label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <Button type="submit" loading={isSubmitting} disabled={inactive}>{config.button}</Button>
    </form>
  );
}

export default function WalletMoneyPage({ kind }) {
  const { walletId } = useParams();
  const wallet = useFetch(() => getWallet(walletId), [walletId]);
  const config = KINDS[kind];

  return (
    <div className="narrow stack">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back</Link>
      <h1>{config.title}</h1>
      <LoadState loading={wallet.loading} error={wallet.error} onRetry={wallet.reload} hasData={!!wallet.data}>
        {wallet.data && (
          <>
            <p className="muted">
              {wallet.data.currency} wallet {wallet.data.reference} &middot; balance{' '}
              <strong>{formatMoney(wallet.data.balance, wallet.data.currency)}</strong>
            </p>
            <div className="card"><MoneyForm wallet={wallet.data} kind={kind} /></div>
          </>
        )}
      </LoadState>
    </div>
  );
}
