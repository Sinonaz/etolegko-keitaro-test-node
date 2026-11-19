export class KeitaroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeitaroError';
  }
}

export class KeitaroNotConfiguredError extends KeitaroError {
  constructor(message = 'Set KEITARO_URL and KEITARO_API_KEY in .env') {
    super(message);
    this.name = 'KeitaroNotConfiguredError';
  }
}

export class KeitaroAPIError extends KeitaroError {
  constructor(
    message: string,
    public readonly statusCode: number | null = null,
    public readonly payload: unknown = null,
  ) {
    super(message);
    this.name = 'KeitaroAPIError';
  }
}
