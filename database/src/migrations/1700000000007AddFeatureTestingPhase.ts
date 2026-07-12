import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFeatureTestingPhase1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE features ADD testingPhase VARCHAR(50) NULL`)
    await queryRunner.query(`ALTER TABLE features ADD testingSubtasks NVARCHAR(MAX) NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE features DROP COLUMN testingSubtasks`)
    await queryRunner.query(`ALTER TABLE features DROP COLUMN testingPhase`)
  }
}
