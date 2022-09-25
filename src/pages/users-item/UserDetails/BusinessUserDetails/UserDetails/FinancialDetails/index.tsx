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
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label
              icon={<FingerprintLineIcon />}
              title={'Expected TransactionAmount per month'}
            />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label
              icon={<FingerprintLineIcon />}
              title={'Expected Turn over per month'}
            />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'} />
          </Card.Column>
          <Card.Column className={s.all}>
            <div>
              {user.tags?.map(({ key, value }: ApiTag) => (
                <Tag color={'cyan'}>
                  {key}: <span style={{ fontWeight: 700 }}>{value}</span>
                </Tag>
              ))}
            </div>
          </Card.Column>
        </Card.Row>
      </div>
    </Card.Section>
  );
}
