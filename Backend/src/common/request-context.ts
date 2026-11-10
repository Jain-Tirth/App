import type { Request } from 'express';

export interface ClientRequestContext {
  ip: string;
  userAgent: string;
  language?: string;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }

  return request.ip ?? request.socket?.remoteAddress ?? '';
}

export function getUserAgent(request: Request): string {
  const userAgent = request.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent : '';
}

export function getRequestedLanguage(
  request: Request,
  explicitLanguage?: string,
): string | undefined {
  return explicitLanguage ?? parseAcceptLanguage(request.headers['accept-language']);
}

export function parseAcceptLanguage(
  header: string | string[] | undefined,
): string | undefined {
  if (!header) {
    return undefined;
  }

  const value = Array.isArray(header) ? header.join(',') : header;
  const first = value.split(',')[0]?.split(';')[0]?.trim().toLowerCase();

  if (!first) {
    return undefined;
  }

  return first.split('-')[0];
}

export function getClientRequestContext(
  request: Request,
  language?: string,
): ClientRequestContext {
  return {
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    language: getRequestedLanguage(request, language),
  };
}
