import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation: whitelist strips unknown properties,
  // forbidNonWhitelisted rejects them with 400.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Hatch platform running on port ${port}`);
}

bootstrap();
