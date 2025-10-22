import { FlatFileProgressResponse, FlatFileSchema } from '@/apis';

export function isOngoingImport(progress: FlatFileProgressResponse): boolean {
  return progress.status === 'PENDING' || progress.status === 'IN_PROGRESS';
}

export function getUserSchemaType(type: 'consumer' | 'business'): FlatFileSchema {
  return type === 'consumer'
    ? ('CONSUMER_USERS_UPLOAD' as FlatFileSchema)
    : ('BUSINESS_USERS_UPLOAD' as FlatFileSchema);
}

export function getUserEntityId(type: 'consumer' | 'business'): string {
  return type === 'consumer' ? 'CONSUMER_USERS' : 'BUSINESS_USERS';
}

export function getTypeFromUrl(list: string): 'consumer' | 'business' {
  return list === 'consumer' ? 'consumer' : 'business';
}
