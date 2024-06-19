import React from 'react';
import CaseStatusTag from './CaseStatusTag';
import UserKycStatusTag from './UserKycStatusTag';
import KeyValueTag from './KeyValueTag';
import ClosingReasonTag from './ClosingReasonTag';
import PaymentMethodTag from './PaymentTypeTag';
import UserStateTag from './UserStateTag';
import RecommendedTag from './RecommendedTag';
import RuleQueueTag from './RuleQueueTag';
import RoleTag from './RoleTag';
import RuleHitInsightsTag from './RuleHitInsightsTag';
import { RuleActionTag } from './RuleActionTag';
import RiskLevelTag from './RiskLevelTag';
import UserTypeTag from './UserTypeTag';
import Tag, { TagColor } from './index';
import { UseCase } from '@/pages/storybook/components';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { PAYMENT_METHODS } from '@/apis/models-custom/PaymentMethod';
import { RULE_ACTIONS } from '@/apis/models-custom/RuleAction';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import SanctionsHitStatusTag from '@/components/ui/SanctionsHitStatusTag';

function TagsList<T>(props: { items: T[]; children: (value: T) => JSX.Element }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      {props.items.map((item, i) => (
        <React.Fragment key={i}>{props.children(item)}</React.Fragment>
      ))}
    </div>
  );
}

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Default use'}>
        <Tag>{'Text content'}</Tag>
      </UseCase>
      <UseCase title={'Colors'}>
        <TagsList<TagColor>
          items={[
            'orange',
            'blue',
            'green',
            'cyan',
            'gold',
            'pink',
            'purple',
            'magenta',
            'volcano',
            'red',
            'processing',
            'success',
            'error',
            'warning',
            'action',
            'gray',
          ]}
        >
          {(color) => <Tag color={color}>{color}</Tag>}
        </TagsList>
      </UseCase>
      <UseCase title={'With actions'}>
        <TagsList
          items={[
            'First tag',
            'Another tag with long content inside, which should be trimmed after some limit of width',
            'Second tag',
            'Third tag',
            'Another long tag here, should be cut somewhere',
            'Fourth tag',
            'Fifth tag',
            'Sixth tag',
            'The Last Tag',
          ]}
        >
          {(text) => (
            <Tag
              key={text}
              color="action"
              actions={[
                {
                  key: 'edit',
                  icon: <PencilLineIcon />,
                  action: () => {
                    console.info(`Edit ${text}`);
                  },
                },
                {
                  key: 'delete',
                  icon: <DeleteBinLineIcon />,
                  action: () => {
                    console.info(`Delete ${text}`);
                  },
                },
              ]}
            >
              {text}
            </Tag>
          )}
        </TagsList>
      </UseCase>
      <UseCase title={'CaseStatusTag'}>
        <TagsList items={CASE_STATUSS}>
          {(caseStatus) => <CaseStatusTag caseStatus={caseStatus} />}
        </TagsList>
      </UseCase>
      <UseCase title={'UserKycStatusTag'}>
        <PropertyMatrix y={[false, true]} yLabel="Reason">
          {(_, useReason) => (
            <TagsList items={KYC_STATUSS}>
              {(status) => (
                <UserKycStatusTag
                  kycStatusDetails={{
                    reason: useReason ? 'Some reason' : undefined,
                    status,
                  }}
                />
              )}
            </TagsList>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'PaymentTypeTag'}>
        <TagsList items={PAYMENT_METHODS}>
          {(paymentMethod) => <PaymentMethodTag paymentMethod={paymentMethod} />}
        </TagsList>
      </UseCase>
      <UseCase title={'KeyValueTag'}>
        <TagsList
          items={[
            {
              key: 'key',
              value: 'value',
            },
            {
              key: 'another key',
              value: 'very, very, very, very, very, very, very, very long text',
            },
          ]}
        >
          {(tag) => <KeyValueTag tag={tag} />}
        </TagsList>
      </UseCase>
      <UseCase title={'UserStateTag'}>
        <TagsList items={USER_STATES}>{(x) => <UserStateTag userState={x} />}</TagsList>
      </UseCase>
      <UseCase title={'RoleTag'}>
        <TagsList items={['root', 'admin', 'user', 'analyst', 'approver', 'auditor', 'developer']}>
          {(x) => <RoleTag role={x} />}
        </TagsList>
      </UseCase>
      <UseCase title={'RecommendedTag'}>
        <TagsList items={['Some tooltip title']}>
          {(x) => <RecommendedTag tooltipTitle={x} />}
        </TagsList>
      </UseCase>
      <UseCase title={'RuleHitInsightsTag'}>
        <PropertyMatrix xLabel="Percentage" x={[0, 1, 5, 10, 100]} yLabel="Runs" y={[0, 10, 100]}>
          {(percentage, runs) => (
            <div>
              <RuleHitInsightsTag percentage={percentage} runs={runs} />
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'RuleQueueTag'}>
        <RuleQueueTag />
      </UseCase>
      <UseCase title={'RuleActionTag'}>
        <TagsList items={RULE_ACTIONS}>{(x) => <RuleActionTag ruleAction={x} />}</TagsList>
      </UseCase>
      <UseCase title={'RiskLevel'}>
        <PropertyMatrix x={[...RISK_LEVELS, undefined]}>
          {(riskLevel: RiskLevel | undefined) => <RiskLevelTag level={riskLevel} />}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'ClosingReasonTag'}>
        <PropertyMatrix x={['False positive', 'Documents collected', 'Single reason', undefined]}>
          {(reason) => (
            <div>
              <ClosingReasonTag>{reason}</ClosingReasonTag>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'UserTypeTag'}>
        <PropertyMatrix x={['BUSINESS', 'CONSUMER'] as const}>
          {(x) => <UserTypeTag type={x} />}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'SanctionsHitStatusTag'}>
        <PropertyMatrix x={['OPEN', 'CLEARED', 'ESCALATED'] as const}>
          {(x) => <SanctionsHitStatusTag status={x} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
