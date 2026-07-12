import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddModuleColumn1700000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features ADD module VARCHAR(50) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD module VARCHAR(50) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('knowledge_files'))
      ALTER TABLE knowledge_files ADD module VARCHAR(50) NULL
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_requirements_appSlug')
      ALTER TABLE requirements DROP CONSTRAINT UQ_requirements_appSlug
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('requirements'))
      ALTER TABLE requirements ADD module VARCHAR(50) NULL
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_requirements_app_module')
      ALTER TABLE requirements ADD CONSTRAINT UQ_requirements_app_module UNIQUE (appSlug, module)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_requirements_app_module')
      ALTER TABLE requirements DROP CONSTRAINT UQ_requirements_app_module
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('requirements'))
      ALTER TABLE requirements DROP COLUMN module
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name='UQ_requirements_appSlug')
      ALTER TABLE requirements ADD CONSTRAINT UQ_requirements_appSlug UNIQUE (appSlug)
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('knowledge_files'))
      ALTER TABLE knowledge_files DROP COLUMN module
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN module
    `)

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='module' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features DROP COLUMN module
    `)
  }
}
