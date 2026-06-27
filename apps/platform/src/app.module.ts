import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AccessModule } from './access/access.module';
import { MeteringModule } from './metering/metering.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    AccessModule,
    MeteringModule,
  ],
})
export class AppModule {}
