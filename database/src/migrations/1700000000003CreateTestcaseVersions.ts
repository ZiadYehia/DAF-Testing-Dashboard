import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateTestcaseVersions1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='testcase_versions' AND xtype='U')
      CREATE TABLE testcase_versions (
        id        INT IDENTITY(1,1) PRIMARY KEY,
        featureId INT           NOT NULL,
        version   INT           NOT NULL,
        content   NVARCHAR(MAX) NOT NULL DEFAULT '',
        createdAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_tv_feature          FOREIGN KEY (featureId)
          REFERENCES features(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tv_feature_version  UNIQUE (featureId, version)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS testcase_versions`)
  }
}
