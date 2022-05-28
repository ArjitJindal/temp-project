import { Button, Descriptions, Result } from 'antd';
import { Link } from 'umi';
import styles from './RuleInstanceCreatedInfo.less';
import { Rule } from '@/apis';

export const RuleInstanceCreatedInfo: React.FC<{
  rule: Rule;
  onFinish: () => Promise<void>;
}> = ({ rule, onFinish }) => {
  return (
    <Result
      status="success"
      title="Rule Successfully activated"
      subTitle="All new transactions will go through this rule"
      extra={
        <>
          <Button type="primary" onClick={onFinish}>
            Create another rule
          </Button>

          <Button>
            <Link to="/rules/my-rules">View my rules</Link>
          </Button>
        </>
      }
      className={styles.result}
    >
      <Descriptions column={1} bordered={false}>
        <Descriptions.Item label="Rule ID"> {rule.id}</Descriptions.Item>
        <Descriptions.Item label="Rule Name"> {rule.name}</Descriptions.Item>
        <Descriptions.Item label="Rule Description"> {rule.description}</Descriptions.Item>
      </Descriptions>
    </Result>
  );
};
