import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Shape errors like FastAPI (`{ detail: ... }`) so the Vue frontend works unchanged.
 */
@Catch()
export class DetailExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body !== null && 'detail' in body
            ? (body as { detail: unknown }).detail
            : typeof body === 'object' && body !== null && 'message' in body
              ? (body as { message: unknown }).message
              : body;
      response.status(status).json({ detail });
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: message });
  }
}
