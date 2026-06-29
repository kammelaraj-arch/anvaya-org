import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', app: 'org-anvaya-api', role: 'organisation-governance', ts: Date.now() };
  }
}
