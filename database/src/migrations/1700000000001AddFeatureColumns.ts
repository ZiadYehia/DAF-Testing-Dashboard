import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFeatureColumns1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('features') AND name = 'jiraKey'
      )
      ALTER TABLE features ADD jiraKey VARCHAR(100) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('features') AND name = 'storyKey'
      )
      ALTER TABLE features ADD storyKey VARCHAR(100) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('features') AND name = 'knowledge'
      )
      ALTER TABLE features ADD knowledge NVARCHAR(MAX) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE features DROP COLUMN knowledge`)
    await queryRunner.query(`ALTER TABLE features DROP COLUMN storyKey`)
    await queryRunner.query(`ALTER TABLE features DROP COLUMN jiraKey`)
  }
}
