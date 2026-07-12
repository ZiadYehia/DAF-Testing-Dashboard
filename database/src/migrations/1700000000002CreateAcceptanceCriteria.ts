import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAcceptanceCriteria1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='acceptance_criteria' AND xtype='U')
      CREATE TABLE acceptance_criteria (
        id             INT IDENTITY(1,1)  PRIMARY KEY,
        featureId      INT                NOT NULL,
        criterionKey   VARCHAR(50)        NOT NULL,
        text           NVARCHAR(MAX)      NOT NULL,
        parentId       VARCHAR(50)        NULL,
        manualCoverage VARCHAR(20)        NULL,
        aiCoveredBy    NVARCHAR(MAX)      NOT NULL DEFAULT '[]',
        aiAnalyzedAt   DATETIME2          NULL,
        sortOrder      INT                NOT NULL DEFAULT 0,
        CONSTRAINT FK_ac_feature     FOREIGN KEY (featureId)
          REFERENCES features(id) ON DELETE CASCADE,
        CONSTRAINT UQ_ac_feature_key UNIQUE (featureId, criterionKey)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS acceptance_criteria`)
  }
}
