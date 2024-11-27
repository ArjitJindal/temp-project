export function formatNumber(
  rawAmount: number,
  options?: { compact?: boolean; keepDecimals?: boolean },
): string {
  const compact = options?.compact ?? false;
  let formattedNumber = `${rawAmount.toFixed(2)}`;
  if (formattedNumber === '-') {
    return formattedNumber;
  }
  if (compact) {
    if (rawAmount >= 1000) {
      formattedNumber = `${Math.round(rawAmount / 10) / 100}`;
    }
    if (rawAmount >= 1000000) {
      formattedNumber = `${Math.round(rawAmount / 10000) / 100}`;
    }
  }

  formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: options?.keepDecimals ? 2 : 0,
  }).format(Number(formattedNumber));

  if (compact) {
    if (rawAmount >= 1000 && rawAmount < 1000000) {
      formattedNumber = `${formattedNumber}k`;
    }
    if (rawAmount >= 1000000) {
      formattedNumber = `${formattedNumber}m`;
    }
  }

  return formattedNumber;
}
