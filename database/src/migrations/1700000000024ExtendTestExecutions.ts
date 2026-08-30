import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: extends test_executions with
 * version/bugSlug, and widens its uniqueness from (featureId, testcaseId) to
 * (featureId, version, testcaseId) — execution status will eventually be
 * tracked per testcase-file version. The original constraint
 * UQ_te_feature_testcase was created in migration 006 (CreateTestExecutions).
 * Not yet read by runtime code.
 */
export class ExtendTestExecutions1700000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='version' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions ADD version INT NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='bugSlug' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions ADD bugSlug VARCHAR(200) NULL
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_te_feature_testcase')
      ALTER TABLE test_executions DROP CONSTRAINT UQ_te_feature_testcase
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase' AND object_id=OBJECT_ID('test_executions'))
      CREATE UNIQUE INDEX UQ_te_feature_version_testcase ON test_executions (featureId, version, testcaseId)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase' AND object_id=OBJECT_ID('test_executions'))
      DROP INDEX UQ_te_feature_version_testcase ON test_executions
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_te_feature_testcase')
      ALTER TABLE test_executions ADD CONSTRAINT UQ_te_feature_testcase UNIQUE (featureId, testcaseId)
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='bugSlug' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions DROP COLUMN bugSlug
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='version' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions DROP COLUMN version
    `)
  }
}
