/** Copies the API's per-field validation errors onto a react-hook-form instance. */
export function applyServerErrors(error, setError, knownFields) {
  let applied = false;
  for (const { field, message } of error?.fieldErrors ?? []) {
    if (knownFields.includes(field)) {
      setError(field, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}

/** Network problems and 5xx mean the outcome is unknown, so the same idempotency key is safe to retry. */
export const isOutcomeUnknown = (error) => !error?.status || error.status >= 500;
