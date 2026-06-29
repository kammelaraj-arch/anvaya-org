import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DedapiKeyGuard } from './dedapi.guard';
import { DedapiService } from './dedapi.service';

// dedapi.org.anvaya.one — the dedicated, API-key-authenticated channel that consuming platforms
// (me.anvaya) use to read the governed country-specific catalogue + rules and validate profiles.
// Single source of truth. No bypass: callers never read the catalogue any other way.
@Controller('dedapi')
@UseGuards(DedapiKeyGuard)
export class DedapiController {
  constructor(private readonly dedapi: DedapiService) {}

  /** Governed guidance for an Information-Library type in a country (the action cards). */
  @Get('guidance')
  async guidance(@Query('type') type?: string, @Query('country') country?: string) {
    const t = (type ?? '').trim();
    const c = (country ?? '').trim();
    const items = t && c ? await this.dedapi.guidance(c, t) : [];
    return { type: t, country: c, governedBy: 'org.anvaya.one', items };
  }

  /** Governed rules for a type in a country (required fields, min age, id formats, notes). */
  @Get('rules')
  async rules(@Query('type') type?: string, @Query('country') country?: string) {
    const t = (type ?? '').trim();
    const c = (country ?? '').trim();
    const rules = t && c ? await this.dedapi.rules(c, t) : [];
    return { type: t, country: c, rules };
  }

  /** Governed compliance notices (regional law + rights) for a country, optionally a type. */
  @Get('compliance')
  async compliance(@Query('type') type?: string, @Query('country') country?: string) {
    const c = (country ?? '').trim();
    const notes = c ? await this.dedapi.compliance(c, (type ?? '').trim() || undefined) : [];
    return { type: (type ?? '').trim(), country: c, governedBy: 'org.anvaya.one', notes };
  }

  /** What countries/types the platform governs (for discovery + sync). */
  @Get('metadata')
  async metadata() {
    return this.dedapi.metadata();
  }

  /** Validate a draft profile/record against the governed rules — used at profile create/update. */
  @Post('validate-profile')
  async validate(@Body() b: { country?: string; type?: string; payload?: Record<string, unknown> }) {
    const c = (b.country ?? '').trim();
    const t = (b.type ?? '').trim();
    if (!c || !t) return { valid: true, issues: [] };
    return this.dedapi.validateProfile(c, t, b.payload ?? {});
  }
}
