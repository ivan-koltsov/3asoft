/**
 * Database Module — Knex connection and tenant-scoped query helpers.
 *
 * Provides a singleton Knex instance and a request-scoped tenant connection
 * that sets `app.current_operator_id` via SET LOCAL in each transaction.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

export const KNEX = Symbol('KNEX');

@Global()
@Module({
  providers: [
    {
      provide: KNEX,
      useFactory: (config: ConfigService): Knex => {
        return knex({
          client: 'pg',
          connection: {
            host: config.get<string>('DATABASE_HOST', 'localhost'),
            port: config.get<number>('DATABASE_PORT', 5432),
            database: config.get<string>('DATABASE_NAME', 'hatch'),
            user: config.get<string>('DATABASE_USER', 'hatch_app'),
            password: config.get<string>('DATABASE_PASSWORD', ''),
          },
          pool: { min: 2, max: 10 },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [KNEX],
})
export class DatabaseModule {}
