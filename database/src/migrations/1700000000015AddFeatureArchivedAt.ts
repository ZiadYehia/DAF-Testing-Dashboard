import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds features.archivedAt — the app-side Feature entity gained this column
 * for soft-delete (archive/restore) but no migration shipped with it, so
 * every feature findOne failed with "Invalid column name 'archivedAt'" and
 * fell back to the filesystem path. NULL means not archived.
 */
export class AddFeatureArchivedAt1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='archivedAt' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features ADD archivedAt DATETIME2 NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='archivedAt' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features DROP COLUMN archivedAt
    `)
  }
}
