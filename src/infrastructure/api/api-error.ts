export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: ApiFieldError[];
}

export function parseApiErrorBody(data: unknown): ApiErrorBody | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const body = data as Partial<ApiErrorBody>;
  if (typeof body.code !== 'string' || typeof body.message !== 'string') {
    return null;
  }

  return body as ApiErrorBody;
}
