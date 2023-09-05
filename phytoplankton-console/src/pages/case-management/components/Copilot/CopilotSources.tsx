import React from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import s from './index.module.less';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NarrativeResponseAttributes } from '@/apis';
import Tooltip from '@/components/library/Tooltip';
type Props = {
  attributes: NarrativeResponseAttributes[];
};
export default function CopilotSources(props: Props) {
  const helper = new ColumnHelper<{ key: string; value: any; secret: boolean }>();
  const { attributes } = props;
  return (
    <div className={s.table}>
      <Table<{ key: string; value: any; secret: boolean }>
        rowKey={'key'}
        sizingMode="FULL_WIDTH"
        pagination={false}
        toolsOptions={false}
        data={{
          total: 0,
          items: [
            ...attributes.map((a) => ({
              key: a.attribute as string,
              value: a.value as any,
              secret: !!a.secret,
            })),
          ].map((a) => {
            let value = a.value;
            if (Array.isArray(a.value)) {
              if (a.value.length > 0) {
                value = a.value.join(', ');
              } else {
                value = '-';
              }
            }
            return {
              key: sentenceCase(a.key),
              value,
              secret: a.secret,
            };
          }),
        }}
        columns={helper.list([
          helper.simple({
            title: 'Attribute',
            key: 'key',
          }),
          helper.display({
            title: 'Value',
            render: (item) => (
              <span
                style={
                  item.secret
                    ? {
                        color: 'transparent',
                        textShadow: '0 0 7px #000',
                      }
                    : undefined
                }
              >
                {item.secret ? (
                  <Tooltip title={'This value was obfuscated before data was sent to OpenAI'}>
                    {item.value}
                  </Tooltip>
                ) : (
                  item.value
                )}
              </span>
            ),
          }),
        ])}
      />
    </div>
  );
}
