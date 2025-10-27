export function formatNumber(
  rawAmount: number | string | undefined,
  options?: { compact?: boolean; keepDecimals?: boolean; showAllDecimals?: boolean },
): string {
  if (rawAmount == null) {
    return '-';
  }

  const { compact = false, keepDecimals = true, showAllDecimals = false } = options ?? {};
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

  if (!isFinite(amount)) {
    return '-';
  }

  // Helper to get correct decimals
  const hasDecimals = amount % 1 !== 0;
  const getNumberFormat = (maxDecimals: number, minDecimals: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: minDecimals,
    });

  if (compact) {
    const absAmount = Math.abs(amount);

    // Determine correct formatted value and suffix
    let display: number, suffix: string;
    if (absAmount >= 1_000_000) {
      display = amount / 1_000_000;
      suffix = 'm';
    } else if (absAmount >= 1_000) {
      display = amount / 1_000;
      suffix = 'k';
    } else if (absAmount === 0) {
      return '0';
    } else {
      display = amount;
      suffix = '';
    }

    const maxDecimals = showAllDecimals ? 20 : 2;
    const minDecimals = showAllDecimals ? 0 : keepDecimals && display % 1 !== 0 ? 2 : 0;
    return `${getNumberFormat(maxDecimals, minDecimals).format(display)}${suffix}`;
  } else {
    const maxDecimals = showAllDecimals ? 20 : keepDecimals ? 2 : 0;
    const minDecimals = showAllDecimals ? 0 : keepDecimals && hasDecimals ? 2 : 0;
    return getNumberFormat(maxDecimals, minDecimals).format(amount);
  }
}

export function isValidNumber(value: number | string | undefined): boolean {
  if (value == null) {
    return false;
  }
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && isFinite(num);
}
