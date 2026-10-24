import { Tabs } from './ui.jsx';

export default function CurrencyTabs({ currencies, value, onChange }) {
  if (currencies.length < 2) return null;
  return <Tabs options={currencies.map((currency) => ({ value: currency, label: currency }))} value={value} onChange={onChange} />;
}
