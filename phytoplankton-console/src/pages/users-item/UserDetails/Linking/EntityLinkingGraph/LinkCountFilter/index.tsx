import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  linkCount: number;
  setLinkCount: (value: number) => void;
}

export function LinkCountFilterButton(props: Props) {
  const { linkCount, setLinkCount } = props;

  return (
    <QuickFilterBase
      analyticsName="filters-link-count"
      title="Link count"
      buttonText={'> ' + linkCount}
      allowClear={false}
    >
      <PopupContent value={[linkCount]} onConfirm={(value) => setLinkCount(value?.[0])} />
    </QuickFilterBase>
  );
}
