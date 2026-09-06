import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Creates `environments` — named run targets (base URLs + credentials) per app, so the suite
 * can be pointed at production, a staging box or a tunnelled laptop without hand-editing
 * automation-hub/.env and remembering to put it back.
 *
 * The unique index is on (appSlug, name) so two apps may each have a "Production". "Exactly
 * one active per app" is enforced in application code instead: a filtered unique index would
 * reject the intermediate state while one row is being cleared and another set.
 */
export class CreateEnvironments1700000000032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='environments')
      CREATE TABLE environments (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        appSlug      VARCHAR(50)    NOT NULL,
        name         NVARCHAR(120)  NOT NULL,
        description  NVARCHAR(500)  NOT NULL CONSTRAINT DF_environments_description DEFAULT '',
        variables    NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_environments_variables DEFAULT '{}',
        isActive     BIT            NOT NULL CONSTRAINT DF_environments_isActive DEFAULT 0,
        createdAt    DATETIME2      NOT NULL CONSTRAINT DF_environments_createdAt DEFAULT SYSUTCDATETIME(),
        updatedAt    DATETIME2      NULL
      )
    `)
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_environments_app_name')
      CREATE UNIQUE INDEX UQ_environments_app_name ON environments (appSlug, name)
    `)
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_environments_app_active')
      CREATE INDEX IX_environments_app_active ON environments (appSlug, isActive)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name='environments') DROP TABLE environments
    `)
  }
}
