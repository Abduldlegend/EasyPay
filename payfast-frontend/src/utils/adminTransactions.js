/** Who a wallet belongs to, for admin screens: a name, the settlement account, or a fallback. */
export function partyName(wallet) {
    if (!wallet) return '-';
    if (wallet.type === 'system') return 'Settlement (external)';
    return wallet.owner?.name ?? wallet.reference ?? '-';
}

/** Short "from → to" summary for a table row. */
export const describeFlow = (tx) => `${partyName(tx.source)} → ${partyName(tx.destination)}`;

/** Plain-English verdict for the ledger check the API returns. */
export function ledgerVerdict(check, status) {
    if (!check) return null;
    if (status !== 'completed' && check.debits === 0 && check.credits === 0) {
        return { ok: true, text: 'No money moved, as expected for this status.' };
    }
    if (!check.balanced) return { ok: false, text: 'Debits and credits do not match. Money was created or lost.' };
    if (!check.entriesAddUp) return { ok: false, text: 'An entry\u2019s balances do not add up.' };
    return { ok: true, text: 'Debits equal credits and every entry adds up.' };
}