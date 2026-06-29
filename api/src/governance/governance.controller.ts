import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OrgAuthGuard, Roles, CurrentOrgUser } from '../auth/auth.guard';
import type { OrgPrincipal } from '../auth/auth.service';
import { GovernanceService, type GuidanceInput, type RuleInput, type ComplianceInput } from './governance.service';
import { AuditService } from '../audit/audit.service';

// Admin governance API (org-console). Any signed-in org user can READ; editor/admin/owner can WRITE.
@Controller('governance')
@UseGuards(OrgAuthGuard)
export class GovernanceController {
  constructor(private readonly gov: GovernanceService, private readonly audit: AuditService) {}

  @Get('meta')
  meta() { return this.gov.meta(); }

  /** Per-country fabric overview (cells + counts) for the console's Fabric view. */
  @Get('overview')
  async overview() { return this.gov.overview(); }

  @Get('guidance')
  async guidance(@Query('country') country?: string, @Query('type') type?: string) {
    return { items: await this.gov.listGuidance(country, type) };
  }

  @Post('guidance')
  @Roles('owner', 'admin', 'editor')
  async setGuidance(@CurrentOrgUser() p: OrgPrincipal, @Body() b: GuidanceInput) {
    return this.gov.setGuidance(p, b);
  }

  @Delete('guidance/:id')
  @Roles('owner', 'admin', 'editor')
  async delGuidance(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string) {
    return this.gov.deleteGuidance(p, id);
  }

  @Get('rules')
  async rules(@Query('country') country?: string, @Query('type') type?: string) {
    return { rules: await this.gov.listRules(country, type) };
  }

  @Post('rules')
  @Roles('owner', 'admin', 'editor')
  async setRule(@CurrentOrgUser() p: OrgPrincipal, @Body() b: RuleInput) {
    return this.gov.setRule(p, b);
  }

  @Delete('rules/:id')
  @Roles('owner', 'admin', 'editor')
  async delRule(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string) {
    return this.gov.deleteRule(p, id);
  }

  @Get('compliance')
  async compliance(@Query('country') country?: string, @Query('type') type?: string) {
    return { notes: await this.gov.listCompliance(country, type) };
  }

  @Post('compliance')
  @Roles('owner', 'admin', 'editor')
  async setCompliance(@CurrentOrgUser() p: OrgPrincipal, @Body() b: ComplianceInput) {
    return this.gov.setCompliance(p, b);
  }

  @Delete('compliance/:id')
  @Roles('owner', 'admin', 'editor')
  async delCompliance(@CurrentOrgUser() p: OrgPrincipal, @Param('id') id: string) {
    return this.gov.deleteCompliance(p, id);
  }

  @Get('audit/verify')
  @Roles('owner', 'admin')
  async auditVerify() {
    return this.audit.verify();
  }
}
