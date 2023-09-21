import React from 'react';
import { Tag } from 'antd';
import s from './index.module.less';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { InternalBusinessUser } from '@/apis';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import User3Line from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import CopperCoinIcon from '@/components/ui/icons/Remix/finance/copper-coin-line.react.svg';
import SecurePaymentIcon from '@/components/ui/icons/Remix/finance/secure-payment-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import GovernmentLineIcon from '@/components/ui/icons/Remix/buildings/government-line.react.svg';
import StoreLineIcon from '@/components/ui/icons/Remix/buildings/store-3-line.react.svg';
import GlobalLineIcon from '@/components/ui/icons/Remix/business/global-line.react.svg';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import { Tag as ApiTag } from '@/apis/models/Tag';
import * as Form from '@/components/ui/Form';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';

interface Props {
  user: InternalBusinessUser;
}

export default function UsersInfoCard(props: Props) {
  const { user } = props;

  const api = useApi();
  const ongoingSanctionsScreeningQueryResult = useQuery(['user-status', user.userId], async () => {
    return await api.getUserScreeningStatus({
      userId: user.userId,
    });
  });

  return (
    <PropertyColumns>
      <Form.Layout.Label icon={<User3Line />} title={'User type'}>
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
      <Form.Layout.Label icon={<GovernmentLineIcon />} title={'Business industry'}>
        <div>
          {user.legalEntity.companyGeneralDetails?.businessIndustry
            ? user.legalEntity.companyGeneralDetails?.businessIndustry.map((industry) => {
                return <Tag>{industry}</Tag>;
              })
            : '-'}
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<CopperCoinIcon />} title={'Main products and services'}>
        {user.legalEntity.companyGeneralDetails?.mainProductsServicesSold ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<EarthLineIcon />} title={'Reason for opening account'}>
        {user.legalEntity.reasonForAccountOpening ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<SecurePaymentIcon />} title={'Allowed payment methods'}>
        <div>
          {user.allowedPaymentMethods
            ? user.allowedPaymentMethods.map((paymentMethod) => {
                return <PaymentMethodTag paymentMethod={paymentMethod}></PaymentMethodTag>;
              })
            : '-'}
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<TimerLineIcon />} title={'Created at'}>
        {dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
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
      <Form.Layout.Label icon={<GlobalLineIcon />} title={'Ongoing sanctions screening'}>
        <div className={s.ongoingSanctions}>
          <AsyncResourceRenderer resource={ongoingSanctionsScreeningQueryResult.data}>
            {({ isOngoingScreening }) =>
              isOngoingScreening ? (
                <>
                  <CheckMark className={s.successIcon} /> Yes
                </>
              ) : (
                <>No</>
              )
            }
          </AsyncResourceRenderer>
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<StoreLineIcon />} title={'Acquisition channel'}>
        {user.acquisitionChannel ?? '-'}
      </Form.Layout.Label>
    </PropertyColumns>
  );
}
