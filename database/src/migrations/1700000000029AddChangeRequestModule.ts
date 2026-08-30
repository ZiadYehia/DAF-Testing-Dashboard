import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChangeRequestModule1700000000029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('change_requests'))
      ALTER TABLE change_requests ADD module VARCHAR(50) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('change_requests'))
      ALTER TABLE change_requests DROP COLUMN module
    `)
  }
}
