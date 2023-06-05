import React from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import s from './index.module.less';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NarrativeResponseAttributes } from '@/apis';

type Props = {
  attributes: NarrativeResponseAttributes[];
};
export default function CopilotSources(props: Props) {
  const helper = new ColumnHelper<{ key: string; value: any }>();
  const { attributes } = props;
  return (
    <div className={s.table}>
      <Table<{ key: string; value: any }>
        rowKey={'key'}
        sizingMode="FULL_WIDTH"
        pagination={false}
        toolsOptions={false}
        data={{
          total: 0,
          items: [
            ...attributes.map((a) => ({ key: a.attribute as string, value: a.value as any })),
          ].map((a) => {
            return {
              ...a,
              key: sentenceCase(a.key),
            };
          }),
        }}
        columns={helper.list([
          helper.simple({
            title: 'Attribute',
            key: 'key',
          }),
          helper.simple({
            title: 'Value',
            key: 'value',
          }),
        ])}
      />
    </div>
  );
}
