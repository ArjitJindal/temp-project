import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import ListTable, { ListTableRef } from '@/pages/lists/ListTable';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import NewListDrawer from '@/pages/lists/NewListDrawer';
import { parseListType, stringifyListType } from '@/pages/lists/helpers';

export default function CreatedListsPage() {
  const location = useLocation();
  const listType = parseListType(location.pathname);

  const navigate = useNavigate();
  const i18n = useI18n();

  const [isNewModalOpen, setNewModalOpen] = useState(false);
  const whitelistsTableRef: ListTableRef = useRef(null);
  const blacklistsTableRef: ListTableRef = useRef(null);

  return (
    <>
      <PageWrapper title={i18n('menu.lists.created-lists')}>
        <PageTabs
          activeKey={stringifyListType(listType)}
          onChange={(key) => {
            navigate(makeUrl(`/lists/:type`, { type: key }), { replace: true });
          }}
          items={[
            {
              key: 'whitelist',
              title: 'Whitelists',
              children: (
                <PageWrapperContentContainer>
                  <ListTable
                    ref={whitelistsTableRef}
                    listType="WHITELIST"
                    extraTools={[
                      () =>
                        listType === 'WHITELIST' && (
                          <>
                            <Button
                              size="LARGE"
                              onClick={() => {
                                setNewModalOpen(true);
                              }}
                              requiredPermissions={['lists:all:write']}
                            >
                              Add new whitelist
                            </Button>
                          </>
                        ),
                    ]}
                  />
                </PageWrapperContentContainer>
              ),
            },
            {
              key: 'blacklist',
              title: 'Blacklists',
              children: (
                <PageWrapperContentContainer>
                  <ListTable
                    ref={blacklistsTableRef}
                    listType="BLACKLIST"
                    extraTools={[
                      () =>
                        listType === 'BLACKLIST' && (
                          <>
                            <Button
                              size="LARGE"
                              onClick={() => {
                                setNewModalOpen(true);
                              }}
                              requiredPermissions={['lists:all:write']}
                            >
                              Add new blacklist
                            </Button>
                          </>
                        ),
                    ]}
                  />
                </PageWrapperContentContainer>
              ),
            },
          ]}
        />
      </PageWrapper>
      <NewListDrawer
        listType={listType}
        isOpen={isNewModalOpen}
        onCancel={() => {
          setNewModalOpen(false);
        }}
        onSuccess={() => {
          setNewModalOpen(false);
          if (listType === 'WHITELIST') {
            whitelistsTableRef.current?.reload();
          }
          if (listType === 'BLACKLIST') {
            blacklistsTableRef.current?.reload();
          }
        }}
      />
    </>
  );
}
