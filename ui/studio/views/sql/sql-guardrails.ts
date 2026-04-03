/**
 * SQL write-operation keywords.
 * A SQL statement starting with one of these is considered a write
 * operation and will be blocked while read-only mode is active.
 */
const WRITE_OPERATION_KEYWORDS = new Set([
  "ALTER",
  "CREATE",
  "DELETE",
  "DROP",
  "INSERT",
  "MERGE",
  "REPLACE",
  "TRUNCATE",
  "UPDATE",
  "UPSERT",
]);

/**
 * Returns `true` when the leading keyword of `sql` is a write operation
 * (INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, etc.).
 *
 * Only the first keyword token is inspected; inline comments and leading
 * whitespace are ignored.
 */
export function isSqlWriteOperation(sql: string): boolean {
  const trimmed = sql.trim();

  if (trimmed.length === 0) {
    return false;
  }

  const firstWord = trimmed.split(/[\s(;]+/, 1)[0]?.toUpperCase();

  return firstWord != null && WRITE_OPERATION_KEYWORDS.has(firstWord);
}
