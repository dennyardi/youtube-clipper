export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Terjadi kesalahan tidak dikenal.";
}

export function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}
