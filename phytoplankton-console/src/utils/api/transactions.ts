export function isTransactionType(value: string): value is string {
  switch (value) {
    case 'DEPOSIT':
    case 'EXTERNAL_PAYMENT':
    case 'WITHDRAWAL':
    case 'REFUND':
    case 'TRANSFER':
    case 'OTHER':
      return true;
  }

  return false;
}
