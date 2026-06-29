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
import { HealthController } from './health.controller';

// org.anvaya.one — the Organisation governance platform. Owns the governed country-specific catalogue
// + rules, serves them over the dedapi channel, and manages org admins + API keys. Independent of the
// family app (me.anvaya): its own DB, its own deployment.
@Module({
  controllers: [HealthController, AuthController, GovernanceController, DedapiController, KeysController],
  providers: [
    { provide: ORG_CONFIG, useFactory: () => loadConfig() },
    OrgRegionRouter,
    AuditService,
    AuthService,
    GovernanceService,
    DedapiService,
    OrgAuthGuard,
    DedapiKeyGuard,
  ],
})
export class AppModule {}
