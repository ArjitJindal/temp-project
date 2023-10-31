import React from 'react';
import PopupContent from './PopupContent';
import BriefcaseIcon from '@/components/ui/icons/Remix/business/briefcase-3-fill.react.svg';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  businessIndustry: string[];
  onConfirm: (state: string[]) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function BusinessIndustryButton(props: Props) {
  const { businessIndustry, onConfirm, onUpdateFilterClose } = props;

  const isEmpty = businessIndustry.length === 0;

  return (
    <QuickFilterBase
      icon={<BriefcaseIcon />}
      analyticsName="business-industry-filter"
      title="Business industry"
      buttonText={isEmpty ? undefined : businessIndustry.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      <PopupContent value={businessIndustry} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}
