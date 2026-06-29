import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().disable?.('x-powered-by');
  app.useBodyParser('json', { limit: '2mb' });
  app.use(cookieParser());
  const cfg = loadConfig();
  // CORS for the org admin console (credentials are cookies); the dedapi channel is key-authed, not cookie.
  const allowed = cfg.appOrigins;
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
      cb(null, !origin || allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)),
    credentials: true,
  });
  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(`org-anvaya-api listening on :${cfg.port}`);
}
void bootstrap();
