import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: additive-only `intake_documents`
 * table. Not yet read by runtime code — the intake system still compiles
 * intake.json into markdown/settings/automation.json on disk.
 */
export class CreateIntakeDocuments1700000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='intake_documents' AND xtype='U')
      CREATE TABLE intake_documents (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        appSlug    VARCHAR(50)   NOT NULL,
        scopeKind  VARCHAR(10)   NOT NULL,
        scopeSlug  VARCHAR(200)  NOT NULL DEFAULT '',
        answers    NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        updatedAt  DATETIME2     NULL,
        CONSTRAINT UQ_intake_app_scope UNIQUE (appSlug, scopeKind, scopeSlug)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS intake_documents`)
  }
}
