import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateTestExecutions1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='test_executions' AND xtype='U')
      CREATE TABLE test_executions (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        featureId  INT               NOT NULL,
        testcaseId VARCHAR(50)       NOT NULL,
        status     VARCHAR(20)       NOT NULL DEFAULT 'new_added',
        updatedAt  DATETIME2         NULL,
        CONSTRAINT FK_te_feature FOREIGN KEY (featureId)
          REFERENCES features(id) ON DELETE CASCADE,
        CONSTRAINT UQ_te_feature_testcase UNIQUE (featureId, testcaseId)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS test_executions`)
  }
}
