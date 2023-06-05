export function formatNumber(amount: number, compact = false): string {
  let formattedNumber = `${amount.toFixed(2)}`;
  if (compact) {
    if (amount >= 1000) {
      formattedNumber = `${Math.round(amount / 10) / 100}`;
    }
    if (amount >= 1000000) {
      formattedNumber = `${Math.round(amount / 10000) / 100}`;
    }
  }

  formattedNumber = new Intl.NumberFormat().format(Number(formattedNumber));

  if (compact && amount >= 1000) {
    formattedNumber = `${formattedNumber}k`;
  }

  return formattedNumber;
}
