import { capitalizeWords } from '@flagright/lib/utils/humanize';
import { EntitiesEnum } from '../../UserGraph';
import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  entities: EntitiesEnum;
  setEntities: (value: EntitiesEnum) => void;
}

export function EntityFilterButton(props: Props) {
  const { entities, setEntities } = props;

  const isEntitiesEmpty = entities === 'all';
  return (
    <QuickFilterBase
      analyticsName="filters-entity"
      title="Entity"
      buttonText={capitalizeWords(entities)}
      onClear={
        isEntitiesEmpty
          ? undefined
          : () => {
              setEntities('all');
            }
      }
    >
      <PopupContent value={[entities]} onConfirm={(value) => setEntities(value?.[0])} />
    </QuickFilterBase>
  );
}
