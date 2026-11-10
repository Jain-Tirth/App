import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const headerValue = request.headers['x-request-id'];
    const requestId =
      (Array.isArray(headerValue) ? headerValue[0] : headerValue) ||
      randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
