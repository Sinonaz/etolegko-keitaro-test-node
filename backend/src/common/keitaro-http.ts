import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  KeitaroAPIError,
  KeitaroError,
  KeitaroNotConfiguredError,
} from '../keitaro/keitaro.exceptions';

export function toHttpException(err: unknown): HttpException {
  if (err instanceof HttpException) return err;

  if (err instanceof KeitaroNotConfiguredError) {
    return new ServiceUnavailableException({ detail: err.message });
  }

  if (err instanceof KeitaroAPIError) {
    return new BadGatewayException({
      detail: {
        message: err.message,
        keitaro_status: err.statusCode,
        keitaro_payload: err.payload,
      },
    });
  }

  if (err instanceof KeitaroError) {
    const message = err.message;
    if (message.toLowerCase().includes('not found')) {
      return new NotFoundException({ detail: message });
    }
    return new BadRequestException({ detail: message });
  }

  throw err;
}
