/**
 * Sanitize a value for safe use in MongoDB queries.
 * Prevents NoSQL injection by rejecting objects that could contain
 * MongoDB query operators ($gt, $ne, $regex, etc.).
 */
export function sanitizeStringParam(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    throw new Error('Invalid parameter: objects are not allowed in query values');
  }
  return String(value);
}
