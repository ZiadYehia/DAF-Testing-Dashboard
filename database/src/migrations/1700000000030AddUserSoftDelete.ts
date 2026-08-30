import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds users.deletedAt — soft-delete (retire) marker. NULL means the user
 * account is active; once set, loginUser/getSession treat the user as if
 * they don't exist, but the row is kept for recovery/audit.
 */
export class AddUserSoftDelete1700000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='deletedAt' AND object_id=OBJECT_ID('users'))
      ALTER TABLE users ADD deletedAt DATETIME2 NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='deletedAt' AND object_id=OBJECT_ID('users'))
      ALTER TABLE users DROP COLUMN deletedAt
    `)
  }
}
