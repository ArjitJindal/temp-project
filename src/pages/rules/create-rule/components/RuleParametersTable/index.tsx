import { Table } from 'antd';
import styles from './style.module.less';

interface Props {
  parameters: object;
  schema: any;
}

export const RuleParametersTable: React.FC<Props> = ({ parameters, schema }) => {
  return (
    <Table
      className={styles.parametersTable}
      pagination={false}
      dataSource={Object.entries(parameters).map((entry) => ({
        key: entry[0],
        value: entry[1],
      }))}
      columns={[
        {
          title: 'Parameter',
          key: 'key',
          render: (_, param) => {
            return schema?.properties?.[param.key]?.title || param.key;
          },
        },
        {
          title: 'Value',
          key: 'value',
          render: (_, param) => {
            return typeof param.value === 'object' ? JSON.stringify(param.value) : param.value;
          },
        },
      ]}
    />
  );
};
