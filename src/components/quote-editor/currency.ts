/** AUD currency formatting — matches the Intl pattern used by the BOM tables. */
const audFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAud(value: number): string {
  return audFormatter.format(Number.isFinite(value) ? value : 0);
}
