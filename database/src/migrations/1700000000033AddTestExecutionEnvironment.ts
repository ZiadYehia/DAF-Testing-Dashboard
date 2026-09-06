import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Scopes execution status to the environment it was observed on, widening
 * test_executions' uniqueness from (featureId, version, testcaseId) to
 * (featureId, version, testcaseId, environment).
 *
 * WHY
 *
 * One row per (feature, version, case) meant one status per case across every server. Running
 * the 400-case API suite against the ngrok relay would have overwritten the production result
 * for all 400 — the two are different servers with different tenants and genuinely different
 * outcomes, and the dashboard had no way to say so. Run history in the Automation Hub was split
 * per environment first; this is the same split for the status the dashboard reports.
 *
 * NULL means "no environment" — every row that exists today, recorded before environments
 * existed. SQL Server treats NULLs as equal in a unique index, so those rows keep exactly one
 * status per case, unchanged, and a named environment can never collide with them.
 *
 * Deliberately NOT backfilled to a named environment. Guessing which server produced a result
 * recorded before environments existed would put a confident label on an unknown, and the whole
 * point of the split is that the label is trustworthy.
 */
export class AddTestExecutionEnvironment1700000000033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='environment' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions ADD environment VARCHAR(100) NULL
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase' AND object_id=OBJECT_ID('test_executions'))
      DROP INDEX UQ_te_feature_version_testcase ON test_executions
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase_env' AND object_id=OBJECT_ID('test_executions'))
      CREATE UNIQUE INDEX UQ_te_feature_version_testcase_env
        ON test_executions (featureId, version, testcaseId, environment)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rows for named environments would collide under the narrower index, so drop them first.
    // They are re-creatable by re-running the suite on that environment; the (no environment)
    // rows this migration never touched are the ones that must survive, and they do.
    await queryRunner.query('DELETE FROM test_executions WHERE environment IS NOT NULL')

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase_env' AND object_id=OBJECT_ID('test_executions'))
      DROP INDEX UQ_te_feature_version_testcase_env ON test_executions
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_te_feature_version_testcase' AND object_id=OBJECT_ID('test_executions'))
      CREATE UNIQUE INDEX UQ_te_feature_version_testcase ON test_executions (featureId, version, testcaseId)
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='environment' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions DROP COLUMN environment
    `)
  }
}
