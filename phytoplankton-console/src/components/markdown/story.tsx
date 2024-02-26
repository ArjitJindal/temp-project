import React from 'react';
import MarkdownEditor from './MarkdownEditor';

export default function (): JSX.Element {
  return (
    <>
      <div
        style={{
          height: '100px',
        }}
      >
        <MarkdownEditor
          onChange={() => {}}
          initialValue="test"
          mentionsEnabled
          mentionsList={[
            { label: 'user1', id: 'user1@flagright.com' },
            { label: 'user2', id: 'user2@flagright.com' },
            { label: 'user3', id: 'user3@flagright.com' },
            { label: 'user4', id: 'user4@flagright.com' },
          ]}
        />
      </div>
    </>
  );
}
