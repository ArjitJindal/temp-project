import axios from 'axios';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';

export async function uploadFile(api: FlagrightApi, file: File): Promise<{ s3Key: string }> {
  // 1. Get S3 presigned URL
  const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});

  // 2. Upload file to S3 directly
  await axios.put(presignedUrl, file, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file?.name)}"`,
    },
  });
  return { s3Key };
}
