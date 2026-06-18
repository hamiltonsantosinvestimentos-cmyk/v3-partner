const GOVERNED_BUCKET = "v3-docs-publico";
const MA_BUCKET = "ma-documents";
const CREDIT_BUCKET = "credit-documents";

export function resolveBucket(storagePath: string, explicitBucket?: string): string {
  if (explicitBucket) return explicitBucket;
  if (
    storagePath.startsWith("MA/") ||
    storagePath.startsWith("Credito/") ||
    storagePath.startsWith("Consorcios/") ||
    storagePath.startsWith("Administracao/")
  ) {
    return GOVERNED_BUCKET;
  }
  return MA_BUCKET;
}

export { GOVERNED_BUCKET, MA_BUCKET, CREDIT_BUCKET };
