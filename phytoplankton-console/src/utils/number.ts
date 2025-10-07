export function formatNumber(
  rawAmount: number | string | undefined,
  options?: { compact?: boolean; keepDecimals?: boolean; showAllDecimals?: boolean },
): string {
  try {
    if (rawAmount == null) {
      return '-';
    }

    const { compact = false, keepDecimals = true, showAllDecimals = false } = options ?? {};

    let amount = 0;

    try {
      amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
    } catch (error) {
      return '-';
    }

    if (isNaN(amount)) {
      return '-';
    }

    let formattedNumber;

    try {
      const numberFormat = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: showAllDecimals ? 20 : keepDecimals ? 2 : 0,
        minimumFractionDigits: showAllDecimals ? 0 : keepDecimals ? 2 : 0,
      });
      formattedNumber = numberFormat.format(amount);
    } catch (error) {
      return '-';
    }

    if (compact) {
      const numberFormat = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: showAllDecimals ? 20 : 2,
        minimumFractionDigits: showAllDecimals ? 0 : 2,
      });
      const absAmount = Math.abs(amount);
      if (absAmount >= 1000000) {
        formattedNumber = `${numberFormat.format(amount / 1000_000)}m`;
      } else if (absAmount >= 1000) {
        formattedNumber = `${numberFormat.format(amount / 1000)}k`;
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
