import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DedapiService } from './dedapi.service';

export interface DedapiCaller { keyId: string; scopes: string[]; region: string | null }

// Guard for the dedapi channel: requires a valid API key (Authorization: Bearer <key> or x-api-key).
// This is how consuming platforms (me.anvaya) authenticate to the governed source of truth.
@Injectable()
export class DedapiKeyGuard implements CanActivate {
  constructor(private readonly dedapi: DedapiService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { dedapi?: DedapiCaller; headers: Record<string, string | string[] | undefined> }>();
    const auth = req.headers['authorization'];
    const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const xkey = req.headers['x-api-key'];
    const presented = bearer ?? (typeof xkey === 'string' ? xkey : undefined);
    if (!presented) throw new UnauthorizedException('Missing API key.');
    const caller = await this.dedapi.authenticate(presented.trim());
    if (!caller) throw new UnauthorizedException('Invalid or revoked API key.');
    req.dedapi = { keyId: caller.id, scopes: caller.scopes, region: caller.region };
    return true;
  }
}
