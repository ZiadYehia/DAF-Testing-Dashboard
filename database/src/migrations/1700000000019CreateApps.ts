import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: additive-only `apps` table.
 * Not yet read by runtime code — app metadata still comes from data/&lt;app&gt;/automation.json.
 */
export class CreateApps1700000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='apps' AND xtype='U')
      CREATE TABLE apps (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        slug         VARCHAR(50)   NOT NULL,
        name         NVARCHAR(200) NOT NULL,
        description  NVARCHAR(MAX) NOT NULL DEFAULT '',
        icon         VARCHAR(50)   NOT NULL DEFAULT '',
        enabled      BIT           NOT NULL DEFAULT 1,
        type         VARCHAR(10)   NOT NULL DEFAULT 'web',
        platform     NVARCHAR(200) NOT NULL DEFAULT '',
        capabilities NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        createdAt    DATETIME2     DEFAULT SYSUTCDATETIME(),
        updatedAt    DATETIME2     NULL,
        CONSTRAINT UQ_apps_slug UNIQUE (slug)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS apps`)
  }
}
