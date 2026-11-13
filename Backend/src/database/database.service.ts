import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import type { DatabaseClient } from './database.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor() {
    const connectionString = env.databaseUrl;

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect();
      client.release();
      this.logger.log('Connected to PostgreSQL successfully.');
    } catch (error) {
      this.logger.warn(
        `PostgreSQL initial ping failed (database may still be starting): ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL connection pool closed.');
  }

  async query<T extends QueryResultRow = any>(
    sql: string,
    params: any[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async callFunction<T extends QueryResultRow = any>(
    funcName: string,
    params: any[] = [],
    client?: DatabaseClient,
  ): Promise<T[]> {
    const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT * FROM ${funcName}(${placeholders})`;

    if (client) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    }

    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async callFunctionSingle<T extends QueryResultRow = any>(
    funcName: string,
    params: any[] = [],
    client?: DatabaseClient,
  ): Promise<T | null> {
    const rows = await this.callFunction<T>(funcName, params, client);
    return rows[0] ?? null;
  }

  async callProcedure(procName: string, params: any[] = []): Promise<void> {
    const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `CALL ${procName}(${placeholders})`;
    await this.pool.query(sql, params);
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
