import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OrgAuthGuard, Roles, CurrentOrgUser } from '../auth/auth.guard';
import type { OrgPrincipal } from '../auth/auth.service';
import { CompaniesHouseService } from './companies-house.service';

// Admin console: verify a UK organisation against Companies House during onboarding, and configure
// the CH API key (owner/admin). The key is stored encrypted; only its set/not-set status is returned.
@Controller('companies')
@UseGuards(OrgAuthGuard)
export class CompaniesController {
  constructor(private readonly ch: CompaniesHouseService) {}

  @Get('status')
  async status() {
    return { configured: await this.ch.configured() };
  }

  @Post('key')
  @Roles('owner', 'admin')
  async setKey(@CurrentOrgUser() p: OrgPrincipal, @Body() b: { key?: string }) {
    if (!b?.key?.trim()) throw new BadRequestException('Enter the Companies House API key.');
    await this.ch.setKey(b.key, p.userId);
    return { ok: true };
  }

  @Get('search')
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) return { configured: await this.ch.configured(), items: [] };
    return this.ch.search(query);
  }

  @Get('company/:number')
  async company(@Param('number') number: string) {
    return this.ch.get(number);
  }
}
