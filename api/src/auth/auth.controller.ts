import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { signSession } from './session';
import { ORG_COOKIE, OrgAuthGuard, Roles, CurrentOrgUser } from './auth.guard';
import { AuthService, type OrgPrincipal, type OrgRole } from './auth.service';
import { Inject } from '@nestjs/common';
import { ORG_CONFIG } from '../core.tokens';
import type { OrgConfig } from '../config';

const ROLES: OrgRole[] = ['owner', 'admin', 'editor', 'viewer'];

@Controller('auth')
export class AuthController {
  constructor(@Inject(ORG_CONFIG) private readonly cfg: OrgConfig, private readonly auth: AuthService) {}

  private setCookie(res: Response, userId: string) {
    res.cookie(ORG_COOKIE, signSession(userId, this.cfg.sessionSecret), {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  /** Whether the platform has been initialised (an owner exists). Drives the bootstrap screen. */
  @Get('status')
  async status() {
    return { initialised: await this.auth.hasUsers() };
  }

  /** Bootstrap the first owner (only when no users exist). */
  @Post('bootstrap')
  async bootstrap(@Body() b: { email?: string; password?: string; displayName?: string }, @Res({ passthrough: true }) res: Response) {
    const p = await this.auth.bootstrap((b.email ?? '').trim(), b.password ?? '', b.displayName?.trim());
    this.setCookie(res, p.userId);
    return { userId: p.userId, role: p.role, email: p.email };
  }

  @Post('login')
  async login(@Body() b: { email?: string; password?: string }, @Res({ passthrough: true }) res: Response) {
    const p = await this.auth.login((b.email ?? '').trim(), b.password ?? '');
    this.setCookie(res, p.userId);
    return { userId: p.userId, role: p.role, email: p.email };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ORG_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(OrgAuthGuard)
  async me(@CurrentOrgUser() p: OrgPrincipal) {
    return this.auth.me(p.userId);
  }

  @Get('users')
  @UseGuards(OrgAuthGuard)
  @Roles('owner', 'admin')
  async users(@CurrentOrgUser() p: OrgPrincipal) {
    return { users: await this.auth.listUsers(p), roles: ROLES };
  }

  @Post('users')
  @UseGuards(OrgAuthGuard)
  @Roles('owner', 'admin')
  async addUser(@CurrentOrgUser() p: OrgPrincipal, @Body() b: { email?: string; password?: string; role?: OrgRole; displayName?: string }) {
    const role = (b.role && ROLES.includes(b.role) ? b.role : 'viewer') as OrgRole;
    return this.auth.createUser(p, (b.email ?? '').trim(), b.password ?? '', role, b.displayName?.trim());
  }
}
