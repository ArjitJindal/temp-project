import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { ListSubtype, ListType, TenantSettings } from '@/apis';
import { neverReturn } from '@/utils/lang';

export function parseListType(pathname): ListType {
  if (pathname.indexOf('blacklist') !== -1) {
    return 'BLACKLIST';
  } else {
    return 'WHITELIST';
  }
}

export function stringifyListType(str: ListType): string {
  return str.toLowerCase();
}

const LIST_SUBTYPES: ListSubtype[] = [
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
  'DEVICE_IDENTIFIER',
  'COUNTRY',
  'STRING',
  'INDIVIDUAL_314' as ListSubtype,
  'BUSINESS_314' as ListSubtype,
];

export const BLACKLIST_SUBTYPES: ListSubtype[] = LIST_SUBTYPES;
export const WHITELIST_SUBTYPES: ListSubtype[] = LIST_SUBTYPES;

export function getListSubtypeTitle(subtype: ListSubtype, tenantSettings: TenantSettings) {
  switch (subtype) {
    case 'USER_ID':
      return `${firstLetterUpper(tenantSettings.userAlias)} ID`;
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
    case 'DEVICE_IDENTIFIER':
      return 'Device identifier';
    case 'STRING':
      return 'Custom';
    case 'COUNTRY':
      return 'Country';
    case 'INDIVIDUAL_314' as ListSubtype:
      return 'Individual (314a)';
    case 'BUSINESS_314' as ListSubtype:
      return 'Business (314a)';
  }
  return neverReturn(subtype, humanizeAuto(subtype));
}

export interface Metadata {
  userFullName?: string;
}
