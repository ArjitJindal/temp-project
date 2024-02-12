export const paginateArray = (
  dataArray: any[],
  pageSize?: number | 'DISABLED',
  pageNumber?: number
): any[] => {
  if (!pageSize || !pageNumber || pageSize == 'DISABLED') {
    return dataArray
  }
  const startIndex = (pageNumber - 1) * pageSize

  const paginatedItems = dataArray.slice(startIndex, startIndex + pageSize)

  return paginatedItems
}
