import { locale } from "./config";

const numberFormats = new Map<string, Intl.NumberFormat>();
export function formatNumber(value: number, digits = 1): string {
  const key = `${locale()}:${digits}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale(), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormats.set(key, formatter);
  }
  return formatter.format(value);
}
