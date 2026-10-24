import { describe, it, expect } from 'vitest';
import { describeFlow, ledgerVerdict, partyName } from './adminTransactions.js';

describe('partyName', () => {
    it('names the owner, the settlement account, or falls back to the reference', () => {
        expect(partyName({ type: 'user', owner: { name: 'Ada' }, reference: 'WLT-1' })).toBe('Ada');
        expect(partyName({ type: 'system', reference: 'WLT-S' })).toBe('Settlement (external)');
        expect(partyName({ type: 'user', reference: 'WLT-1' })).toBe('WLT-1');
        expect(partyName(null)).toBe('-');
    });

    it('describes a flow', () => {
        const tx = { source: { type: 'system' }, destination: { type: 'user', owner: { name: 'Ada' } } };
        expect(describeFlow(tx)).toBe('Settlement (external) → Ada');
    });
});

describe('ledgerVerdict', () => {
    it('is fine when balanced and adding up', () => {
        expect(ledgerVerdict({ debits: 5, credits: 5, balanced: true, entriesAddUp: true }, 'completed').ok).toBe(true);
    });
    it('flags unbalanced and inconsistent ledgers', () => {
        expect(ledgerVerdict({ debits: 5, credits: 4, balanced: false, entriesAddUp: true }, 'completed').ok).toBe(false);
        expect(ledgerVerdict({ debits: 5, credits: 5, balanced: true, entriesAddUp: false }, 'completed').ok).toBe(false);
    });
    it('accepts a failed transaction with no entries', () => {
        expect(ledgerVerdict({ debits: 0, credits: 0, balanced: true, entriesAddUp: true }, 'failed').ok).toBe(true);
    });
    it('returns null without a check', () => {
        expect(ledgerVerdict(undefined, 'completed')).toBeNull();
    });
});