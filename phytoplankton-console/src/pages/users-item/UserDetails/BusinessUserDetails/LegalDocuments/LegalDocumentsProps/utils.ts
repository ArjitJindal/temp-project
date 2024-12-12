export const maskDocumentNumber = (documentNumber: string): string => {
  if (!documentNumber) {
    return '';
  }

  const digits = documentNumber.length;

  if (digits <= 4) {
    const maskedPart = 'X'.repeat(digits - 1);
    const lastDigit = documentNumber.slice(-1);

    return maskedPart + lastDigit;
  }

  const maskedPart = 'X'.repeat(digits - 4);
  const lastFourDigits = documentNumber.slice(-4);

  return maskedPart + lastFourDigits;
};
