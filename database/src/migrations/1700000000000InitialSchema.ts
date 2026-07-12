import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='features' AND xtype='U')
      CREATE TABLE features (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        appSlug     VARCHAR(50)      NOT NULL,
        name        VARCHAR(200)     NOT NULL,
        workflow    NVARCHAR(MAX)    NOT NULL DEFAULT '',
        testcases   NVARCHAR(MAX)    NOT NULL DEFAULT '',
        lastModified DATETIME2       NULL,
        CONSTRAINT UQ_features_app_name UNIQUE (appSlug, name)
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='screenshots' AND xtype='U')
      CREATE TABLE screenshots (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        featureId  INT          NOT NULL,
        fileName   VARCHAR(500) NOT NULL,
        mimeType   VARCHAR(100) NOT NULL,
        data       VARBINARY(MAX) NOT NULL,
        uploadedAt DATETIME2    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_screenshots_feature FOREIGN KEY (featureId)
          REFERENCES features(id) ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bugs' AND xtype='U')
      CREATE TABLE bugs (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        appSlug     VARCHAR(50)   NOT NULL,
        feature     VARCHAR(200)  NOT NULL,
        slug        VARCHAR(200)  NOT NULL,
        title       NVARCHAR(500) NOT NULL,
        status      VARCHAR(20)   NOT NULL DEFAULT 'draft',
        jiraKey     VARCHAR(100)  NULL,
        reportedAt  DATETIME2     NULL,
        priority    VARCHAR(10)   NOT NULL DEFAULT '',
        bugType     VARCHAR(100)  NOT NULL DEFAULT '',
        body        NVARCHAR(MAX) NOT NULL DEFAULT '',
        CONSTRAINT UQ_bugs_app_feature_slug UNIQUE (appSlug, feature, slug)
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='attachments' AND xtype='U')
      CREATE TABLE attachments (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        bugId      INT           NOT NULL,
        fileName   VARCHAR(500)  NOT NULL,
        mimeType   VARCHAR(100)  NOT NULL,
        data       VARBINARY(MAX) NOT NULL,
        uploadedAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_attachments_bug FOREIGN KEY (bugId)
          REFERENCES bugs(id) ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='knowledge_files' AND xtype='U')
      CREATE TABLE knowledge_files (
        id       INT IDENTITY(1,1) PRIMARY KEY,
        appSlug  VARCHAR(50)   NOT NULL,
        filename VARCHAR(500)  NOT NULL,
        content  NVARCHAR(MAX) NOT NULL DEFAULT '',
        CONSTRAINT UQ_knowledge_app_filename UNIQUE (appSlug, filename)
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='requirements' AND xtype='U')
      CREATE TABLE requirements (
        id      INT IDENTITY(1,1) PRIMARY KEY,
        appSlug VARCHAR(50)   NOT NULL,
        content NVARCHAR(MAX) NOT NULL DEFAULT '',
        CONSTRAINT UQ_requirements_appSlug UNIQUE (appSlug)
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='settings' AND xtype='U')
      CREATE TABLE settings (
        id        INT IDENTITY(1,1) PRIMARY KEY,
        scope     VARCHAR(100)  NOT NULL,
        [key]     VARCHAR(200)  NOT NULL,
        value     NVARCHAR(MAX) NOT NULL DEFAULT '',
        updatedAt DATETIME2     NULL,
        CONSTRAINT UQ_settings_scope_key UNIQUE (scope, [key])
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS attachments`)
    await queryRunner.query(`DROP TABLE IF EXISTS screenshots`)
    await queryRunner.query(`DROP TABLE IF EXISTS bugs`)
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_files`)
    await queryRunner.query(`DROP TABLE IF EXISTS requirements`)
    await queryRunner.query(`DROP TABLE IF EXISTS settings`)
    await queryRunner.query(`DROP TABLE IF EXISTS features`)
  }
}
