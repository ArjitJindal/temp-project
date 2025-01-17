import { GraphFilters } from '../../UserGraph';
import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  filters: GraphFilters;
  setFilters: React.Dispatch<React.SetStateAction<GraphFilters>>;
}

export function LinkCountFilterButton(props: Props) {
  const { filters, setFilters } = props;

  const isEntitiesEmpty = filters.linkCount.length === 0;
  return (
    <QuickFilterBase
      analyticsName="filters-link-count"
      title="Link count"
      buttonText={isEntitiesEmpty ? undefined : '>' + filters.linkCount.join(', ')}
      onClear={
        isEntitiesEmpty
          ? undefined
          : () => {
              setFilters({ ...filters, linkCount: [] });
            }
      }
    >
      <PopupContent
        value={filters.linkCount}
        onConfirm={(value) => setFilters({ ...filters, linkCount: value })}
      />
    </QuickFilterBase>
  );
}
