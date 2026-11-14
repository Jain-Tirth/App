import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { ApiException, type ApiErrorEnvelope } from './api-error';

interface ErrorDescription {
  status: number;
  code: string;
  message: string;
  details: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const description = this.describe(exception);

    if (description.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorEnvelope = {
      code: description.code,
      message: description.message,
      details: description.details,
      requestId,
    };

    response.setHeader('x-request-id', requestId);

    if (exception instanceof ApiException) {
      for (const [name, value] of Object.entries(exception.headers)) {
        response.setHeader(name, value);
      }
    }

    response.status(description.status).json(body);
  }

  private describe(exception: unknown): ErrorDescription {
    if (exception instanceof ApiException) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
      details: null,
    };
  }

  private describeHttpException(exception: HttpException): ErrorDescription {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        status,
        code: this.codeForStatus(status),
        message: response,
        details: null,
      };
    }

    const body = response as Record<string, unknown>;
    const message = body.message;

    if (Array.isArray(message)) {
      return {
        status,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: { issues: message },
      };
    }

    return {
      status,
      code:
        typeof body.code === 'string'
          ? body.code
          : this.codeForStatus(status),
      message:
        typeof message === 'string'
          ? message
          : exception.message || this.codeForStatus(status),
      details: body.details ?? null,
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_ERROR'
          : 'HTTP_ERROR';
    }
  }
}
