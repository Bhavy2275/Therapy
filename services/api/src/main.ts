import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });


  // ── 1. Security Headers (Helmet) ──────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── 2. Rate Limiting (Brute-force & DDoS protection) ───────────────────────
  // General API rate limit: 100 requests per 15 minutes
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many requests, please try again later.' },
  });
  app.use('/api/', generalLimiter);

  // Strict Auth rate limit: 10 attempts per 15 minutes per IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many authentication attempts. Please wait 15 minutes.' },
  });
  app.use('/api/v1/auth/', authLimiter);

  // ── 3. Input Validation & Field Tampering Protection ──────────────────────
  // Whitelist strips undeclared fields; forbidNonWhitelisted throws if attacker tries adding extra fields
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── 4. Strict CORS ────────────────────────────────────────────────────────
  const normalizeOrigin = (val?: string): string | null => {
    if (!val) return null;
    try {
      return new URL(val).origin;
    } catch {
      return val.replace(/\/+$/, '');
    }
  };

  const allowedOrigins = [
    normalizeOrigin(process.env.WEB_URL),
    normalizeOrigin(process.env.PRODUCTION_WEB_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    'https://jarwishelpme.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          (origin.includes('localhost') || origin.includes('127.0.0.1')));

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS request from unauthorized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ── 5. Global API Prefix ──────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── 6. Swagger API Documentation (Dev only) ───────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Therapy Platform API')
      .setDescription('Core API for the therapy marketplace')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc);
    logger.log('Swagger available at /api/docs');
  }

  const port = process.env.PORT ?? process.env.API_PORT ?? 3001;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api/v1`);
}

await bootstrap();
