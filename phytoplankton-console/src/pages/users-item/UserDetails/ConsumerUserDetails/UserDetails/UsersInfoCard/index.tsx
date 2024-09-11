import React from 'react';
import { uniqBy } from 'lodash';
import s from './index.module.less';
import PlaceOfBirth from './PlaceOfBirth';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, DEFAULT_DATE_FORMAT, dayjs } from '@/utils/dayjs';
import { InternalConsumerUser } from '@/apis';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import Calender2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import BookmarkLineIcon from '@/components/ui/icons/Remix/business/bookmark-3-line.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import Home4LineIcon from '@/components/ui/icons/Remix/buildings/home-4-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import SuitCaseLineIcon from '@/components/ui/icons/Remix/map/suitcase-line.react.svg';
import StoreLineIcon from '@/components/ui/icons/Remix/buildings/store-3-line.react.svg';
import MaritalStatusIcon from '@/components/ui/icons/Remix/user/user-heart-line.react.svg';
import * as Form from '@/components/ui/Form';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { Tag as ApiTag } from '@/apis/models/Tag';
import UserTypeTag from '@/components/library/Tag/UserTypeTag';
import Tag from '@/components/library/Tag';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import CommunityLineIcon from '@/components/ui/icons/Remix/buildings/community-line.react.svg';

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
            ? dayjs(user.userDetails?.dateOfBirth).format(DEFAULT_DATE_FORMAT)
            : '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<User3LineIcon />} title={'User type'}>
          <div>
            <UserTypeTag type="CONSUMER" />
          </div>
        </Form.Layout.Label>
        <Form.Layout.Label icon={<EarthLineIcon />} title={'Nationality'}>
          <CountryDisplay isoCode={user.userDetails?.countryOfNationality} />
        </Form.Layout.Label>
        <Form.Layout.Label icon={<Home4LineIcon />} title={'Residence'}>
          <CountryDisplay isoCode={user.userDetails?.countryOfResidence} />
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<TimerLineIcon />} title={'Created at'}>
          {dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<MaritalStatusIcon />} title={'Marital status'}>
          {user.userDetails?.maritalStatus ?? '-'}
        </Form.Layout.Label>
      </div>
      <div className={s.placeOfBirth}>
        <Form.Layout.Label icon={<CommunityLineIcon />} title={'Place of birth'}>
          {user.userDetails?.placeOfBirth ? <PlaceOfBirth user={user} /> : '-'}
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<SuitCaseLineIcon />} title={'Occupation'}>
          {user?.occupation ?? '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<SuitCaseLineIcon />} title={'Sector'}>
          {user?.employmentDetails?.employmentSector ?? '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<SuitCaseLineIcon />} title={'Industry'}>
          {user?.employmentDetails?.businessIndustry ?? '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<SuitCaseLineIcon />} title={'Employer'}>
          {user?.employmentDetails?.employerName ?? '-'}
        </Form.Layout.Label>
      </div>
      <div className={s.inner}>
        <Form.Layout.Label icon={<BookmarkLineIcon />} title={'Consumer segment'}>
          {user.userSegment ?? '-'}
        </Form.Layout.Label>
        <Form.Layout.Label icon={<StoreLineIcon />} title={'Acquisition channel'}>
          {user.acquisitionChannel ?? '-'}
        </Form.Layout.Label>
      </div>
      {user.reasonForAccountOpening?.length ? (
        <div className={s.inner}>
          <Form.Layout.Label icon={<EarthLineIcon />} title={'Reason for opening account'}>
            <TagList>
              {user.reasonForAccountOpening.map((reason) => (
                <Tag key={reason}>{reason}</Tag>
              ))}
            </TagList>
          </Form.Layout.Label>
        </div>
      ) : (
        <></>
      )}
      {user.sourceOfFunds?.length ? (
        <div className={s.inner}>
          <Form.Layout.Label icon={<EarthLineIcon />} title={'Source of funds'}>
            <TagList>
              {user.sourceOfFunds.map((source) => (
                <Tag key={source}>{source}</Tag>
              ))}
            </TagList>
          </Form.Layout.Label>
        </div>
      ) : (
        <></>
      )}
      <div className={s.tag}>
        <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'}>
          <div className={s.tags}>
            {user.tags?.map((tag: ApiTag) => (
              <KeyValueTag key={tag.key} tag={tag} />
            ))}
          </div>
        </Form.Layout.Label>
      </div>
      {user?.pepStatus !== undefined && (
        <div className={s.tag}>
          <Form.Layout.Label
            orientation="horizontal"
            icon={<BookmarkLineIcon />}
            title={'PEP Status'}
          >
            {uniqBy(
              user.pepStatus.filter((pep) => pep.isPepHit),
              'pepCountry',
            )
              .map((pep) => pep.pepCountry)
              .map((pepCountry) => {
                return <CountryDisplay key={pepCountry} isoCode={pepCountry} />;
              })}
          </Form.Layout.Label>
        </div>
      )}
    </div>
  );
}
