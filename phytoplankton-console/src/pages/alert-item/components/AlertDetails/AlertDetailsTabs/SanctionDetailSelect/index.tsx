import { humanizeConstant } from '@flagright/lib/utils/humanize';
import cn from 'classnames';
import s from './index.module.less';
import { SanctionsDetails } from '@/apis';
import Select from '@/components/library/Select';

interface Props {
  sanctionDetails: SanctionsDetails[];
  selectedItem: SanctionsDetails;
  setSelectedItem: (item: SanctionsDetails) => void;
  marginBottom?: boolean;
}
export default function SanctionDetailSelect(props: Props) {
  const { sanctionDetails, selectedItem, setSelectedItem, marginBottom } = props;

  return (
    <div className={cn(s.root, marginBottom && s.marginBottom)}>
      <Select
        value={
          (selectedItem?.hitContext?.paymentMethodId ?? selectedItem?.searchId) +
          ' ' +
          selectedItem?.entityType
        }
        isDisabled={sanctionDetails.length < 2}
        options={sanctionDetails.map((detailsItem) => ({
          label: getOptionName(detailsItem),
          value:
            (detailsItem.hitContext?.paymentMethodId ?? detailsItem.searchId) +
            ' ' +
            detailsItem.entityType,
        }))}
        onChange={(value) => {
          const selectedItem = sanctionDetails.find((item) => {
            if (
              item.hitContext?.paymentMethodId === value?.split(' ')[0] &&
              item.entityType === value?.split(' ')[1]
            ) {
              return true;
            }
            if (
              item.searchId === value?.split(' ')[0] &&
              !item.hitContext?.paymentMethodId &&
              item.entityType === value?.split(' ')[1]
            ) {
              return true;
            }
            return false;
          });
          if (selectedItem) {
            setSelectedItem(selectedItem);
          }
        }}
        allowClear={false}
      />
    </div>
  );
}

/*
  Helpers
 */

export function getOptionName(details: SanctionsDetails) {
  let result = details.name;
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`;
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}
