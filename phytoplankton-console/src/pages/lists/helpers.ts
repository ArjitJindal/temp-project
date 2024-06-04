import { ListSubtype, ListType } from '@/apis';
import { neverReturn } from '@/utils/lang';

export function parseListType(str: string | undefined): ListType {
  if (str === 'whitelist') {
    return 'WHITELIST';
  } else {
    return 'BLACKLIST';
  }
}

export function stringifyListType(str: ListType): string {
  return str.toLowerCase();
}

export const BLACKLIST_SUBTYPES: ListSubtype[] = [
  'USER_ID',
  'CARD_FINGERPRINT_NUMBER',
  'IBAN_NUMBER',
  'BANK_ACCOUNT_NUMBER',
  'ACH_ACCOUNT_NUMBER',
  'SWIFT_ACCOUNT_NUMBER',
  'BIC',
  'BANK_SWIFT_CODE',
  'UPI_IDENTIFYING_NUMBER',
  'IP_ADDRESS',
];
export const WHITELIST_SUBTYPES: ListSubtype[] = ['USER_ID'];

export function getListSubtypeTitle(subtype: ListSubtype) {
  switch (subtype) {
    case 'USER_ID':
      return 'User ID';
    case 'CARD_FINGERPRINT_NUMBER':
      return 'Card fingerprint number';
    case 'IBAN_NUMBER':
      return 'IBAN number';
    case 'BANK_ACCOUNT_NUMBER':
      return 'Bank account number';
    case 'ACH_ACCOUNT_NUMBER':
      return 'ACH account number';
    case 'SWIFT_ACCOUNT_NUMBER':
      return 'SWIFT account number';
    case 'BIC':
      return 'BIC';
    case 'BANK_SWIFT_CODE':
      return 'Bank SWIFT code';
    case 'UPI_IDENTIFYING_NUMBER':
      return 'UPI/Identifying number';
    case 'IP_ADDRESS':
      return 'IP address';
    case 'STRING':
      return 'String';
  }
  return neverReturn(subtype, 'Unknown subtype');
}

export interface Metadata {
  userFullName?: string;
}
