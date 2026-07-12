import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds bugs.severity and bugs.layer — per-app configurable bug format lets
 * apps turn Severity on before Jira supports it as a native field, and Layer
 * (frontend/backend/unknown) drives the Jira summary prefix. Existing rows
 * get the column defaults, so this is backward compatible.
 */
export class AddBugSeverityLayer1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='severity' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD severity VARCHAR(50) NOT NULL CONSTRAINT DF_bugs_severity DEFAULT ''
    `)
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='layer' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD layer VARCHAR(20) NOT NULL CONSTRAINT DF_bugs_layer DEFAULT 'unknown'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='layer' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP CONSTRAINT DF_bugs_layer
    `)
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='layer' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN layer
    `)
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='severity' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP CONSTRAINT DF_bugs_severity
    `)
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='severity' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN severity
    `)
  }
}
