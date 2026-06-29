import { Module } from '@nestjs/common';
import { loadConfig } from './config';
import { ORG_CONFIG } from './core.tokens';
import { OrgRegionRouter } from './db/client';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { OrgAuthGuard } from './auth/auth.guard';
import { GovernanceService } from './governance/governance.service';
import { GovernanceController } from './governance/governance.controller';
import { DedapiService } from './dedapi/dedapi.service';
import { DedapiController } from './dedapi/dedapi.controller';
import { DedapiKeyGuard } from './dedapi/dedapi.guard';
import { KeysController } from './dedapi/keys.controller';
import { ConfigStore } from './settings/config-store';
import { CompaniesHouseService } from './companies/companies-house.service';
import { CompaniesController } from './companies/companies.controller';
import { HealthController } from './health.controller';

// org.anvaya.one — the Organisation governance platform. Owns the governed country-specific catalogue
// + rules, serves them over the dedapi channel, manages org admins + API keys, and verifies UK
// organisations via Companies House. Independent of the family app (me.anvaya): own DB + deployment.
@Module({
  controllers: [HealthController, AuthController, GovernanceController, DedapiController, KeysController, CompaniesController],
  providers: [
    { provide: ORG_CONFIG, useFactory: () => loadConfig() },
    OrgRegionRouter,
    AuditService,
    AuthService,
    GovernanceService,
    DedapiService,
    ConfigStore,
    CompaniesHouseService,
    OrgAuthGuard,
    DedapiKeyGuard,
  ],
})
export class AppModule {}
