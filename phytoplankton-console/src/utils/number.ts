export function formatNumber(
  rawAmount: number | string | undefined,
  options?: { compact?: boolean; keepDecimals?: boolean },
): string {
  try {
    if (rawAmount == null) {
      return '-';
    }

    const compact = options?.compact ?? false;
    let amount = 0;

    try {
      amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
    } catch (error) {
      return '-';
    }

    if (isNaN(amount)) {
      return '-';
    }

    let formattedNumber = amount.toFixed(2);

    if (formattedNumber === '-') {
      return formattedNumber;
    }

    if (compact) {
      const absAmount = Math.abs(amount);
      if (absAmount >= 1000000) {
        formattedNumber = `${Math.round(amount / 10000) / 100}`;
      } else if (absAmount >= 1000) {
        formattedNumber = `${Math.round(amount / 10) / 100}`;
      }
    }

    try {
      formattedNumber = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: options?.keepDecimals ? 2 : 0,
      }).format(Number(formattedNumber));
    } catch (error) {
      return '-';
    }

    if (compact) {
      const absAmount = Math.abs(amount);
      if (absAmount >= 1000000) {
        formattedNumber = `${formattedNumber}m`;
      } else if (absAmount >= 1000) {
        formattedNumber = `${formattedNumber}k`;
      }
    }

    return formattedNumber;
  } catch (error) {
    return '-';
  }
}

export function isValidNumber(value: number | string | undefined): boolean {
  if (value == null) {
    return false;
  }
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && isFinite(num);
}
