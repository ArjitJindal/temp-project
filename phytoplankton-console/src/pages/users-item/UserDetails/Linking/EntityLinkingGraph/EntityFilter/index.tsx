import { GraphFilters } from '../../UserGraph';
import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  filters: GraphFilters;
  setFilters: React.Dispatch<React.SetStateAction<GraphFilters>>;
}

export function EntityFilterButton(props: Props) {
  const { filters, setFilters } = props;

  const isEntitiesEmpty = filters.entities.length === 0;
  return (
    <QuickFilterBase
      analyticsName="filters-entity"
      title="Entity"
      buttonText={isEntitiesEmpty ? undefined : filters.entities.join(', ')}
      onClear={
        isEntitiesEmpty
          ? undefined
          : () => {
              setFilters({ ...filters, entities: [] });
            }
      }
    >
      <PopupContent
        value={filters.entities}
        onConfirm={(value) => setFilters({ ...filters, entities: value })}
      />
    </QuickFilterBase>
  );
}
