import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { ListSubtypeInternal, ListType, TenantSettings } from '@/apis';
import { neverReturn } from '@/utils/lang';
import { LIST_SUBTYPE_INTERNALS } from '@/apis/models-custom/ListSubtypeInternal';

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

export const BLACKLIST_SUBTYPES = LIST_SUBTYPE_INTERNALS;
export const WHITELIST_SUBTYPES = LIST_SUBTYPE_INTERNALS;

export function getListSubtypeTitle(subtype: ListSubtypeInternal, tenantSettings: TenantSettings) {
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
      return 'String';
    case 'COUNTRY':
      return 'Country';
    case '314A_INDIVIDUAL':
      return 'Individual (314a)';
    case '314A_BUSINESS':
      return 'Business (314a)';
    case 'CUSTOM':
      return 'Custom';
  }
  return neverReturn(subtype, humanizeAuto(subtype));
}

export interface Metadata {
  userFullName?: string;
}
