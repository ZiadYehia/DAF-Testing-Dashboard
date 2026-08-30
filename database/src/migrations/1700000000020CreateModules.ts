import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: additive-only `modules` table.
 * Not yet read by runtime code — module metadata still comes from data/&lt;app&gt;/automation.json.
 */
export class CreateModules1700000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='modules' AND xtype='U')
      CREATE TABLE modules (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        appSlug     VARCHAR(50)   NOT NULL,
        slug        VARCHAR(50)   NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        icon        VARCHAR(50)   NOT NULL DEFAULT '',
        sortOrder   INT           NOT NULL DEFAULT 0,
        pathPrefix  VARCHAR(100)  NOT NULL DEFAULT '',
        description NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_modules_app_slug UNIQUE (appSlug, slug)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS modules`)
  }
}
