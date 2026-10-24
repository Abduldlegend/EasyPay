import { ArrowLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { transfer } from '../api/transactions.api.js';
import { useWallets } from '../hooks/useWallets.js';
import { Alert, Button, Field, LoadState } from '../components/ui.jsx';
import TransactionResult from '../components/TransactionResult.jsx';
import { applyServerErrors, isOutcomeUnknown } from '../utils/errors.js';
import { newIdempotencyKey } from '../utils/idempotency.js';
import { formatMoney, MAX_AMOUNT_MINOR, toMinorUnits } from '../utils/money.js';

const schema = z.object({
  sourceWalletId: z.string().min(1, 'Choose a wallet'),
  recipient: z
    .string()
    .trim()
    .regex(/^WLT-[0-9A-F]{10}$/i, 'Enter a valid wallet reference, e.g. WLT-9F3A1C07B2'),
  amount: z.string().trim().min(1, 'Enter an amount'),
  description: z.string().trim().max(140, 'Description must be 140 characters or less').optional(),
});

function TransferForm({ wallets, defaultSourceId }) {
  const idempotencyKey = useRef(newIdempotencyKey());
  const [step, setStep] = useState('form'); // form -> review -> done
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const { register, handleSubmit, setError, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { sourceWalletId: defaultSourceId, recipient: '', amount: '', description: '' },
  });

  const source = wallets.find((wallet) => wallet._id === watch('sourceWalletId'));

  const onReview = (values) => {
    const wallet = wallets.find((item) => item._id === values.sourceWalletId);
    const recipient = values.recipient.trim().toUpperCase();
    const amount = toMinorUnits(values.amount);

    if (recipient === wallet.reference) {
      return setError('recipient', { message: 'You cannot transfer to the same wallet' });
    }
    if (amount === null || amount <= 0) {
      return setError('amount', { message: 'Enter a valid amount (up to 2 decimal places)' });
    }
    if (amount > MAX_AMOUNT_MINOR) {
      return setError('amount', { message: `Maximum is ${formatMoney(MAX_AMOUNT_MINOR, wallet.currency)} per transaction` });
    }
    if (amount > wallet.balance) {
      return setError('amount', { message: 'Amount is more than your available balance' });
    }

    setDraft({ wallet, recipient, amount, description: values.description || undefined });
    setStep('review');
  };

  const confirm = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      const { transaction } = await transfer({
        sourceWalletId: draft.wallet._id,
        destinationWalletReference: draft.recipient,
        amount: draft.amount,
        description: draft.description,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = newIdempotencyKey();
      setResult(transaction);
      setStep('done');
    } catch (error) {
      if (isOutcomeUnknown(error)) {
        setFormError(`${error.message} If you try again you will not be charged twice.`);
      } else {
        idempotencyKey.current = newIdempotencyKey();
        setFormError(error.message);
        // Send the user back to fix the field the API complained about, if any.
        if (applyServerErrors(error, setError, ['amount', 'description'])) setStep('form');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <TransactionResult
        transaction={result}
        title="Transfer"
        onAnother={() => { reset(); setDraft(null); setResult(null); setStep('form'); }}
      />
    );
  }

  if (step === 'review') {
    return (
      <div className="stack">
        <h2>Review transfer</h2>
        <Alert>{formError}</Alert>
        <dl className="details">
          <dt>From</dt><dd>{draft.wallet.currency} wallet ({draft.wallet.reference})</dd>
          <dt>To</dt><dd>{draft.recipient}</dd>
          <dt>Amount</dt><dd><strong>{formatMoney(draft.amount, draft.wallet.currency)}</strong></dd>
          {draft.description && (<><dt>Description</dt><dd>{draft.description}</dd></>)}
        </dl>
        <p className="muted small">Check the wallet reference carefully. Transfers cannot be undone from this app.</p>
        <div className="row gap">
          <Button loading={submitting} onClick={confirm}>Confirm transfer</Button>
          <Button variant="secondary" disabled={submitting} onClick={() => setStep('form')}>Edit</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={handleSubmit(onReview)} noValidate>
      <Field as="select" label="From wallet" error={errors.sourceWalletId?.message} {...register('sourceWalletId')}>
        {wallets.map((wallet) => (
          <option key={wallet._id} value={wallet._id} disabled={wallet.status !== 'active'}>
            {wallet.currency} - {formatMoney(wallet.balance, wallet.currency)} ({wallet.reference})
          </option>
        ))}
      </Field>
      <Field label="Recipient wallet reference" placeholder="WLT-XXXXXXXXXX" autoComplete="off"
        error={errors.recipient?.message} hint="Ask the recipient for their wallet reference" {...register('recipient')} />
      <Field label={`Amount (${source?.currency ?? ''})`} inputMode="decimal" placeholder="0.00"
        error={errors.amount?.message} {...register('amount')} />
      <Field label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <Button type="submit">Review</Button>
    </form>
  );
}

export default function TransferPage() {
  const wallets = useWallets();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('from');

  return (
    <div className="narrow stack">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back</Link>
      <h1>Transfer money</h1>
      <LoadState loading={wallets.loading} error={wallets.error} onRetry={wallets.reload} hasData={!!wallets.data}>
        {wallets.data?.length === 0 && <p className="muted">Create a wallet first, then fund it to make transfers.</p>}
        {wallets.data?.length > 0 && (
          <div className="card">
            <TransferForm
              wallets={wallets.data}
              defaultSourceId={wallets.data.find((wallet) => wallet._id === requestedId)?._id ?? wallets.data[0]._id}
            />
          </div>
        )}
      </LoadState>
    </div>
  );
}
