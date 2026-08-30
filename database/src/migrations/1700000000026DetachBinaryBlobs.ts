import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: prepares screenshots/attachments
 * for detached binary storage — makes `data` nullable (a future phase will move
 * bytes off-row and leave `data` NULL) and adds `byteSize` for size tracking
 * without loading the blob. Nothing is dropped; existing rows keep their bytes.
 * Not yet read by runtime code.
 */
export class DetachBinaryBlobs1700000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE name='data' AND object_id=OBJECT_ID('screenshots') AND is_nullable = 0
      )
      ALTER TABLE screenshots ALTER COLUMN data VARBINARY(MAX) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='byteSize' AND object_id=OBJECT_ID('screenshots'))
      ALTER TABLE screenshots ADD byteSize INT NULL
    `)

    await queryRunner.query(`
      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE name='data' AND object_id=OBJECT_ID('attachments') AND is_nullable = 0
      )
      ALTER TABLE attachments ALTER COLUMN data VARBINARY(MAX) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='byteSize' AND object_id=OBJECT_ID('attachments'))
      ALTER TABLE attachments ADD byteSize INT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='byteSize' AND object_id=OBJECT_ID('attachments'))
      ALTER TABLE attachments DROP COLUMN byteSize
    `)

    await queryRunner.query(`
      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE name='data' AND object_id=OBJECT_ID('attachments') AND is_nullable = 1
      )
      ALTER TABLE attachments ALTER COLUMN data VARBINARY(MAX) NOT NULL
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='byteSize' AND object_id=OBJECT_ID('screenshots'))
      ALTER TABLE screenshots DROP COLUMN byteSize
    `)

    await queryRunner.query(`
      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE name='data' AND object_id=OBJECT_ID('screenshots') AND is_nullable = 1
      )
      ALTER TABLE screenshots ALTER COLUMN data VARBINARY(MAX) NOT NULL
    `)
  }
}
