import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrgAuthGuard, Roles, CurrentOrgUser } from '../auth/auth.guard';
import type { OrgPrincipal } from '../auth/auth.service';
import { DedapiService } from './dedapi.service';

// Admin management of dedapi API keys (owner/admin). The plaintext key is returned ONCE on create.
@Controller('keys')
@UseGuards(OrgAuthGuard)
@Roles('owner', 'admin')
export class KeysController {
  constructor(private readonly dedapi: DedapiService) {}

  @Get()
  async list() {
    return { keys: await this.dedapi.listKeys() };
  }

  @Post()
  async create(@CurrentOrgUser() p: OrgPrincipal, @Body() b: { name?: string; scopes?: string[]; region?: string }) {
    return this.dedapi.createKey(p, (b.name ?? '').trim(), b.scopes, b.region);
  }

  @Delete(':id')
  async revoke(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string) {
    return this.dedapi.revokeKey(p, id);
  }
}
