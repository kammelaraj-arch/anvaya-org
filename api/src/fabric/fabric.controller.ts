import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrgAuthGuard, Roles, CurrentOrgUser } from '../auth/auth.guard';
import type { OrgPrincipal } from '../auth/auth.service';
import { FabricService, type CellInput } from './fabric.service';

// Admin console: configure the per-country fabric cells (enable/disable, display name, notes). Any
// signed-in org user can read the topology; owner/admin can change cell configuration.
@Controller('fabric')
@UseGuards(OrgAuthGuard)
export class FabricController {
  constructor(private readonly fabric: FabricService) {}

  @Get('cells')
  async cells() {
    return this.fabric.listCells();
  }

  @Post('cells')
  @Roles('owner', 'admin')
  async setCell(@CurrentOrgUser() p: OrgPrincipal, @Body() b: CellInput) {
    return this.fabric.upsertCell(p, b);
  }
}
