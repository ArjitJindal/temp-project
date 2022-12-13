import React from 'react';
import { Tag } from 'antd';
import s from './index.module.less';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { InternalBusinessUser } from '@/apis';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import User3Line from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import CopperCoinIcon from '@/components/ui/icons/Remix/finance/copper-coin-line.react.svg';
import SecurePaymentIcon from '@/components/ui/icons/Remix/finance/secure-payment-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import GovernmentLineIcon from '@/components/ui/icons/Remix/buildings/government-line.react.svg';
import { Tag as ApiTag } from '@/apis/models/Tag';
import * as Form from '@/components/ui/Form';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';

interface Props {
  user: InternalBusinessUser;
}

export default function UsersInfoCard(props: Props) {
  const { user } = props;
  return (
    <div className={s.fields}>
      <Form.Layout.Label icon={<User3Line />} title={'User Type'}>
        <div>
          <Tag
            style={{
              backgroundColor: '#E6F8FF',
              borderColor: '#78CBEB',
            }}
          >
            Business
          </Tag>
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<GovernmentLineIcon />} title={'Business Industry'}>
        <div>
          {user.legalEntity.companyGeneralDetails?.businessIndustry
            ? user.legalEntity.companyGeneralDetails?.businessIndustry.map((industry) => {
                return <Tag>{industry}</Tag>;
              })
            : '-'}
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<CopperCoinIcon />} title={'Main Products and Services'}>
        {user.legalEntity.companyGeneralDetails?.mainProductsServicesSold ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<EarthLineIcon />} title={'Reason for opening account'}>
        {user.legalEntity.reasonForAccountOpening ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<SecurePaymentIcon />} title={'Allowed Payment Methods'}>
        <div>
          {user.allowedPaymentMethods
            ? user.allowedPaymentMethods.map((paymentMethod) => {
                return <PaymentMethodTag paymentMethod={paymentMethod}></PaymentMethodTag>;
              })
            : '-'}
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<TimerLineIcon />} title={'Created on'}>
        {dayjs(user.createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT)}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'}>
        <div>
          {user.tags?.map(({ key, value }: ApiTag) => (
            <Tag color={'cyan'}>
              {key}: <span style={{ fontWeight: 700 }}>{value}</span>
            </Tag>
          ))}
        </div>
      </Form.Layout.Label>
    </div>
  );
}
