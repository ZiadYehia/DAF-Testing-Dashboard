import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: additive-only `automation_configs`
 * table. Not yet read by runtime code — automation config still comes from
 * data/&lt;app&gt;/automation.json.
 */
export class CreateAutomationConfigs1700000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='automation_configs' AND xtype='U')
      CREATE TABLE automation_configs (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        appSlug             VARCHAR(50)   NOT NULL,
        baseUrlEnv          VARCHAR(200)  NOT NULL DEFAULT '',
        credentialEnvs      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        login               NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        generatedFromIntake BIT           NOT NULL DEFAULT 0,
        updatedAt           DATETIME2     NULL,
        CONSTRAINT UQ_automation_app UNIQUE (appSlug)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS automation_configs`)
  }
}
