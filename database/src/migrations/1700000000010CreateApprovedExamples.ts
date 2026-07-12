import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateApprovedExamples1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='approved_examples' AND xtype='U')
      CREATE TABLE approved_examples (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        featureId     INT               NOT NULL,
        content       NVARCHAR(MAX)     NOT NULL DEFAULT '',
        source        VARCHAR(20)       NOT NULL DEFAULT 'approved',
        sourceVersion INT               NULL,
        createdAt     DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ae_feature FOREIGN KEY (featureId)
          REFERENCES features(id) ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS approved_examples`)
  }
}
