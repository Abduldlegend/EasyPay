const labelFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Picks one currency out of the API's daily trend and adds a short date label for the chart. */
export const trendForCurrency = (trend = [], currency) =>
    trend.map((day) => ({
        label: labelFormat.format(new Date(`${day.date}T00:00:00Z`)),
        volume: day[currency]?.volume ?? 0,
        count: day[currency]?.count ?? 0,
    }));

export const hasVolume = (series) => series.some((day) => day.volume > 0);

/** Share of transactions that ended in each status, for the status bar. Skips empty statuses. */
export function statusShares(byStatus = {}) {
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    if (total === 0) return [];
    return Object.entries(byStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ status, count, percent: Math.round((count / total) * 100) }));
}