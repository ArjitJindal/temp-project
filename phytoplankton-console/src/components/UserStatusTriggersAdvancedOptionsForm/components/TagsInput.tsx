import React, { useEffect, useState } from 'react';
import { UserTag } from '@/apis';
import { InputProps } from '@/components/library/Form/types';
import ApiTagsTable from '@/pages/users-item/Header/EditTagsModal/ApiTagsTable';

function TagsInput(props: InputProps<UserTag[]>) {
  const { value, onChange } = props;
  const [tags, setTags] = useState<UserTag[] | undefined>(value);
  useEffect(() => {
    onChange?.(tags);
  }, [tags]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <ApiTagsTable tags={tags} setTags={setTags} />
    </div>
  );
}

export default TagsInput;
