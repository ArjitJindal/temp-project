import { useState } from 'react';
import _ from 'lodash';
import { JsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { Report } from '@/apis';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import {
  getOrderedProps,
  getUiSchema,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';

export default function ReportStep(props: {
  settings: Partial<JsonSchemaEditorSettings>;
  report: Report;
}) {
  const { settings, report } = props;

  const orderedProps = getOrderedProps(report.schema?.reportSchema);
  console.log('orderedProps', orderedProps);

  const groups = Object.entries(
    _.groupBy(orderedProps, (property) => getUiSchema(property.schema)['ui:group']),
  ).map(([group, properties]) => ({ group: group === 'undefined' ? 'Other' : group, properties }));

  const menuItems = groups.map(({ group }) => ({
    key: group,
    title: group,
  }));

  const [activeMenuItem, setActiveMenuItem] = useState<string>(groups[0]?.group ?? 'Other');

  const activeGroup = groups.find((x) => x.group === activeMenuItem);
  console.log('activeGroup', activeGroup);
  console.log('groups', groups);

  return (
    <VerticalMenu items={menuItems} active={activeMenuItem} onChange={setActiveMenuItem}>
      {activeGroup?.properties && (
        <JsonSchemaEditor
          settings={settings}
          parametersSchema={{
            ...report.schema?.reportSchema,
            properties: activeGroup?.properties.reduce(
              (acc, x) => ({ ...acc, [x.name]: x.schema }),
              {},
            ),
          }}
        />
      )}
    </VerticalMenu>
  );
}
