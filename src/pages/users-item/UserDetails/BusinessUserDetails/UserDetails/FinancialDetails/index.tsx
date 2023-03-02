import React from 'react';
import { Tag } from 'antd';
import s from './index.module.less';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import FingerprintLineIcon from '@/components/ui/icons/Remix/device/fingerprint-line.react.svg';
import * as Form from '@/components/ui/Form';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import { Tag as ApiTag } from '@/apis/models/Tag';

interface Props {
  user: InternalBusinessUser;
}

export function FinancialDetails(prop: Props) {
  const { user } = prop;
  return (
    <Card.Section>
      <div className={s.details}>
        <Card.Row>
          <Form.Layout.Label
            icon={<FingerprintLineIcon />}
            title={'Expected Transaction Amount per month'}
          >
            <div>
              {user.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth?.amountValue?.toLocaleString()}{' '}
              {
                user.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth
                  ?.amountCurrency
              }
            </div>
          </Form.Layout.Label>
        </Card.Row>
        <Card.Row>
          <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Expected Turn over per month'}>
            <span>
              {user.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth?.amountValue?.toLocaleString()}{' '}
              {user.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth?.amountCurrency}
            </span>
          </Form.Layout.Label>
        </Card.Row>
        <Card.Row>
          <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'}>
            <div>
              {user.legalEntity.companyFinancialDetails?.tags?.map(({ key, value }: ApiTag) => (
                <Tag color={'cyan'}>
                  {key}: <span style={{ fontWeight: 700 }}>{value}</span>
                </Tag>
              ))}
            </div>
          </Form.Layout.Label>
        </Card.Row>
      </div>
    </Card.Section>
  );
}
