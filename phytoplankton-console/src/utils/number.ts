export function formatNumber(
  rawAmount: number | string,
  options?: {
    compact?: boolean;
    keepDecimals?: boolean;
  },
): string {
  const amount = Number(rawAmount ?? 0);
  if (!Number.isFinite(amount)) {
    return '-';
  }
  const compact = options?.compact ?? false;
  let formattedNumber = `${Number(amount ?? 0).toFixed(2)}`;
  if (formattedNumber === '-') {
    return formattedNumber;
  }
  if (compact) {
    if (amount >= 1000) {
      formattedNumber = `${Math.round(amount / 10) / 100}`;
    }
    if (amount >= 1000000) {
      formattedNumber = `${Math.round(amount / 10000) / 100}`;
    }
  }

  formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options?.keepDecimals ? 2 : 0,
  }).format(Number(formattedNumber));

  if (compact && amount >= 1000) {
    formattedNumber = `${formattedNumber}k`;
  }

  return formattedNumber;
}
