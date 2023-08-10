import React from 'react';
import { Tag } from 'antd';
import s from './index.module.less';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { InternalConsumerUser } from '@/apis';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import Calender2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import BookmarkLineIcon from '@/components/ui/icons/Remix/business/bookmark-3-line.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import Home4LineIcon from '@/components/ui/icons/Remix/buildings/home-4-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import StoreLineIcon from '@/components/ui/icons/Remix/buildings/store-3-line.react.svg';
import * as Form from '@/components/ui/Form';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { Tag as ApiTag } from '@/apis/models/Tag';

interface Props {
  user: InternalConsumerUser;
}

export default function UsersInfoCard(props: Props) {
  const { user } = props;
  return (
    <div className={s.fields}>
      <div className={s.inner}>
        <Form.Layout.Label icon={<Calender2LineIcon />} title={'DOB'}>
          {user.userDetails?.dateOfBirth
            ? dayjs(user.userDetails?.dateOfBirth).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
            : '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<User3LineIcon />} title={'User Type'}>
          <div>
            <Tag
              style={{
                backgroundColor: '#FFF4E5',
                borderColor: '#F6A429',
              }}
            >
              Consumer
            </Tag>
          </div>
        </Form.Layout.Label>
        <Form.Layout.Label icon={<EarthLineIcon />} title={'Nationality'}>
          <CountryDisplay isoCode={user.userDetails?.countryOfNationality} />
        </Form.Layout.Label>
        <Form.Layout.Label icon={<Home4LineIcon />} title={'Residence'}>
          <CountryDisplay isoCode={user.userDetails?.countryOfResidence} />
        </Form.Layout.Label>
      </div>
      <div className={s.time}>
        <Form.Layout.Label icon={<TimerLineIcon />} title={'Created on'}>
          {dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<StoreLineIcon />} title={'Acquisition Channel'}>
          {user.acquisitionChannel ?? '-'}
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<BookmarkLineIcon />} title={'Consumer Segment'}>
          {user.userSegment ?? '-'}
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<EarthLineIcon />} title={'Reason for opening account'}>
          {user.reasonForAccountOpening ? (
            <div>
              {user.reasonForAccountOpening.map((reason) => {
                return <Tag>{reason}</Tag>;
              })}
            </div>
          ) : (
            '-'
          )}
        </Form.Layout.Label>
      </div>
      <div className={s.tag}>
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
    </div>
  );
}
