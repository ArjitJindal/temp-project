import dayjsModule from '@/utils/dayjs';

export const getFormatedDate = (date: string): string => {
  const currentDate = dayjsModule.dayjs();
  const inputDate = dayjsModule.dayjs(date);

  const formattedDate = inputDate.format('D MMM YYYY [at] HH:mm');
  const relativeTime = inputDate.from(currentDate, true);

  return `${formattedDate} (${relativeTime})`;
};
