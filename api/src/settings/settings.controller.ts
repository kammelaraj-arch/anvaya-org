import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrgAuthGuard, Roles, CurrentOrgUser } from '../auth/auth.guard';
import type { OrgPrincipal } from '../auth/auth.service';
import { SettingsService } from './settings.service';

// Admin console: manage platform configuration + integration API keys (owner/admin). Secret values
// are write-only — the API returns set-status + provenance but never the stored secret.
@Controller('settings')
@UseGuards(OrgAuthGuard)
@Roles('owner', 'admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async list() {
    return { entries: await this.settings.list(), runtime: this.settings.runtime() };
  }

  @Post(':id')
  async set(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string, @Body() b: { value?: string }) {
    return this.settings.set(p, id, b?.value ?? '');
  }

  @Delete(':id')
  async clear(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string) {
    return this.settings.clear(p, id);
  }
}
