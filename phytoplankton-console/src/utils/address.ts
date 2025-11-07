import { Address } from '@/apis';

export function getAddressString(address: Address): string {
  return [
    ...address.addressLines,
    address.city,
    address.state,
    address.postcode,
    address.country,
  ].join(', ');
}
