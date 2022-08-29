import { Descriptions, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import styles from './style.module.less';
import { Rule } from '@/apis';
import Button from '@/components/ui/Button';

export const RuleInstanceCreatedInfo: React.FC<{
  rule: Rule;
  onFinish: () => Promise<void>;
}> = ({ rule, onFinish }) => {
  const navigate = useNavigate();
  return (
    <Result
      status="success"
      title="Rule Successfully activated"
      subTitle="All new transactions will go through this rule"
      extra={
        <>
          <Button analyticsName="Create another rule" type="primary" onClick={onFinish}>
            Create another rule
          </Button>

          <Button
            analyticsName="View my rules"
            onClick={() => {
              navigate(`/rules/my-rules`, { replace: true });
            }}
          >
            View my rules
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
