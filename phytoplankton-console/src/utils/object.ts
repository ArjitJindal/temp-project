import { dayjs } from './dayjs';
import { Tag } from '@/apis';

export const processTagsRecursively = (obj: any): any => {
  if (!obj) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(processTagsRecursively);
  }

  if (typeof obj === 'object') {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'tags' && Array.isArray(value)) {
        processed[key] = value.map((tag: Tag) => ({
          ...tag,
          value: tag.isTimestamp ? dayjs(Number(tag.value)).toISOString() : tag.value,
        }));
      } else {
        processed[key] = processTagsRecursively(value);
      }
    }
    return processed;
  }

  return obj;
};
