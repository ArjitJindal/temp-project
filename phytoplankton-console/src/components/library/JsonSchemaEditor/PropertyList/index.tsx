import { useMemo, useState } from 'react';
import Property from '../Property';
import { ExtendedSchema, PropertyItems } from '../types';
import { getScopeSelectorItems, getUiSchema } from '../utils';
import SegmentedControl from '../../SegmentedControl';
import s from './style.module.less';
import { Props as LabelProps } from '@/components/library/Label';

interface Props {
  items: PropertyItems;
  labelProps?: Partial<LabelProps>;
  collapseForNestedProperties?: boolean;
  parentSchema?: ExtendedSchema;
}

export default function PropertyList(props: Props): JSX.Element {
  const { items, labelProps, collapseForNestedProperties, parentSchema } = props;
  const scopeSelectorItems = getScopeSelectorItems(parentSchema);
  const [selectedSection, setSelectedSection] = useState(
    scopeSelectorItems?.length ? scopeSelectorItems[0].value : null,
  );
  const scopeItems = useMemo(() => {
    if (!selectedSection) {
      return items;
    }
    return items.filter((item) => {
      const uiSchema = getUiSchema(item.schema);
      if (!uiSchema) {
        return false;
      }
      const scope = uiSchema['ui:scope'];
      return scope === selectedSection;
    });
  }, [selectedSection, items]);

  const columns = scopeItems.some((item) => getUiSchema(item.schema)['ui:width'] === 'HALF')
    ? 2
    : 1;

  return (
    <>
      {!!scopeSelectorItems?.length && (
        <SegmentedControl<string>
          size="LARGE"
          active={selectedSection as string}
          onChange={(newValue) => {
            setSelectedSection(newValue);
          }}
          items={scopeSelectorItems}
        />
      )}
      <PropertyListLayout columns={columns}>
        {scopeItems.map((item) => {
          const width = getUiSchema(item.schema)['ui:width'] ?? 'FULL';
          return (
            <div key={item.name} style={{ gridColumn: `span ${width === 'FULL' ? 2 : 1}` }}>
              <Property
                item={item}
                labelProps={labelProps}
                collapseForNestedProperties={collapseForNestedProperties}
                parentSchema={parentSchema}
              />
            </div>
          );
        })}
      </PropertyListLayout>
    </>
  );
}

export function PropertyListLayout(props: { columns?: number; children: React.ReactNode }) {
  return (
    <div
      className={s.root}
      style={{ gridTemplateColumns: props.columns ? `repeat(${props.columns}, 1fr)` : undefined }}
    >
      {props.children}
    </div>
  );
}
