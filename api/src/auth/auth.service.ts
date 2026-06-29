import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { OrgRegionRouter } from '../db/client';
import { AuditService } from '../audit/audit.service';
import * as s from '../db/schema';

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';
export interface OrgPrincipal { userId: string; role: OrgRole; email: string }
export interface OrgUserView { id: string; email: string; displayName: string | null; role: OrgRole; status: string; lastLogin: number | null }

const rid = () => randomBytes(8).toString('hex');
const view = (u: typeof s.orgUsers.$inferSelect): OrgUserView =>
  ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role as OrgRole, status: u.status, lastLogin: u.lastLogin });

// Org-admin identity for org.anvaya.one. The FIRST account bootstraps as 'owner'; further accounts
// are created by an owner/admin (no open public signup once bootstrapped). Passwords are bcrypt-hashed.
@Injectable()
export class AuthService {
  constructor(private readonly router: OrgRegionRouter, private readonly audit: AuditService) {}
  private get db() { return this.router.common(); }

  async hasUsers(): Promise<boolean> {
    const rows = await this.db.select({ id: s.orgUsers.id }).from(s.orgUsers).limit(1);
    return rows.length > 0;
  }

  /** Bootstrap the first owner. Allowed ONLY when no users exist yet. */
  async bootstrap(email: string, password: string, displayName?: string): Promise<OrgPrincipal> {
    if (await this.hasUsers()) throw new ForbiddenException('Already initialised — ask an administrator to add you.');
    return this.insertUser(email, password, 'owner', displayName, 'system');
  }

  /** Create a new org user (owner/admin only). */
  async createUser(by: OrgPrincipal, email: string, password: string, role: OrgRole, displayName?: string): Promise<OrgUserView> {
    if (by.role !== 'owner' && by.role !== 'admin') throw new ForbiddenException('Only owners and admins can add users.');
    if (role === 'owner' && by.role !== 'owner') throw new ForbiddenException('Only an owner can grant the owner role.');
    const p = await this.insertUser(email, password, role, displayName, by.userId);
    return { id: p.userId, email: p.email, displayName: displayName ?? null, role, status: 'active', lastLogin: null };
  }

  private async insertUser(email: string, password: string, role: OrgRole, displayName: string | undefined, by: string): Promise<OrgPrincipal> {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new BadRequestException('Enter a valid email address.');
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
    const existing = (await this.db.select().from(s.orgUsers).where(eq(s.orgUsers.email, e)))[0];
    if (existing) throw new BadRequestException('An account with this email already exists.');
    const id = `ou_${rid()}`;
    const now = Date.now();
    await this.db.insert(s.orgUsers).values({
      id, email: e, passwordHash: await bcrypt.hash(password, 10), displayName: displayName ?? null,
      role, status: 'active', createdBy: by, createdAt: now, updatedAt: now,
    });
    await this.audit.record('org_user', 'INSERT', id, by);
    return { userId: id, role, email: e };
  }

  async login(email: string, password: string): Promise<OrgPrincipal> {
    const e = email.trim().toLowerCase();
    const u = (await this.db.select().from(s.orgUsers).where(eq(s.orgUsers.email, e)))[0];
    if (!u || u.status !== 'active' || !(await bcrypt.compare(password, u.passwordHash))) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    await this.db.update(s.orgUsers).set({ lastLogin: Date.now() }).where(eq(s.orgUsers.id, u.id));
    return { userId: u.id, role: u.role as OrgRole, email: u.email };
  }

  async principalById(userId: string): Promise<OrgPrincipal | null> {
    const u = (await this.db.select().from(s.orgUsers).where(eq(s.orgUsers.id, userId)))[0];
    if (!u || u.status !== 'active') return null;
    return { userId: u.id, role: u.role as OrgRole, email: u.email };
  }

  async me(userId: string): Promise<OrgUserView> {
    const u = (await this.db.select().from(s.orgUsers).where(eq(s.orgUsers.id, userId)))[0];
    if (!u) throw new UnauthorizedException();
    return view(u);
  }

  async listUsers(by: OrgPrincipal): Promise<OrgUserView[]> {
    if (by.role !== 'owner' && by.role !== 'admin') throw new ForbiddenException('Only owners and admins can list users.');
    const rows = await this.db.select().from(s.orgUsers).orderBy(sql`${s.orgUsers.createdAt} asc`);
    return rows.map(view);
  }
}
