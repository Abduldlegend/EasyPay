import { describe, it, expect } from 'vitest';
import { hasVolume, statusShares, trendForCurrency } from './adminStats.js';

describe('trendForCurrency', () => {
    const trend = [
        { date: '2026-10-21', NGN: { count: 3, volume: 120000 }, USD: { count: 0, volume: 0 } },
        { date: '2026-10-22', NGN: { count: 0, volume: 0 }, USD: { count: 1, volume: 500 } },
    ];

    it('selects one currency and labels the date', () => {
        expect(trendForCurrency(trend, 'NGN')).toEqual([
            { label: 'Oct 21', volume: 120000, count: 3 },
            { label: 'Oct 22', volume: 0, count: 0 },
        ]);
    });

    it('treats a missing currency as zero and handles no data', () => {
        expect(trendForCurrency(trend, 'EUR').every((d) => d.volume === 0)).toBe(true);
        expect(trendForCurrency(undefined, 'NGN')).toEqual([]);
    });

    it('hasVolume is false for an all-zero series', () => {
        expect(hasVolume(trendForCurrency(trend, 'NGN'))).toBe(true);
        expect(hasVolume([{ volume: 0 }])).toBe(false);
    });
});

describe('statusShares', () => {
    it('returns percentages and skips empty statuses', () => {
        expect(statusShares({ completed: 3, pending: 0, failed: 1 })).toEqual([
            { status: 'completed', count: 3, percent: 75 },
            { status: 'failed', count: 1, percent: 25 },
        ]);
    });
    it('returns nothing when there are no transactions', () => {
        expect(statusShares({ completed: 0 })).toEqual([]);
    });
});