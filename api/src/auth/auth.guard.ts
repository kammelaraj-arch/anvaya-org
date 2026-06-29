import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { verifySession } from './session';
import { ORG_CONFIG } from '../core.tokens';
import type { OrgConfig } from '../config';
import { AuthService, type OrgPrincipal, type OrgRole } from './auth.service';

export const ORG_COOKIE = 'anv_org_session';

// Roles metadata — annotate a handler/controller with the minimum role(s) allowed.
export const ROLES_KEY = 'org_roles';
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);

// Guard: requires a valid signed org session cookie; loads + attaches the OrgPrincipal. When @Roles
// is present, also enforces the caller has one of the listed roles.
@Injectable()
export class OrgAuthGuard implements CanActivate {
  constructor(
    @Inject(ORG_CONFIG) private readonly cfg: OrgConfig,
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { orgUser?: OrgPrincipal; cookies?: Record<string, string> }>();
    const userId = verifySession(req.cookies?.[ORG_COOKIE], this.cfg.sessionSecret);
    if (!userId) throw new UnauthorizedException();
    const principal = await this.auth.principalById(userId);
    if (!principal) throw new UnauthorizedException();
    req.orgUser = principal;
    const roles = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles && roles.length && !roles.includes(principal.role)) {
      throw new ForbiddenException('You do not have permission for this action.');
    }
    return true;
  }
}

export const CurrentOrgUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): OrgPrincipal => {
  const req = ctx.switchToHttp().getRequest<Request & { orgUser?: OrgPrincipal }>();
  if (!req.orgUser) throw new UnauthorizedException();
  return req.orgUser;
});
