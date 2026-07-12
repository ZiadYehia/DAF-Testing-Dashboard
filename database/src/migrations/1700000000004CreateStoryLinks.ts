import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateStoryLinks1700000000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'story_links')
      BEGIN
        CREATE TABLE story_links (
          id INT IDENTITY(1,1) NOT NULL,
          appSlug VARCHAR(50) NOT NULL,
          frId VARCHAR(100) NOT NULL,
          storyKey VARCHAR(100) NOT NULL DEFAULT '',
          CONSTRAINT PK_story_links PRIMARY KEY (id),
          CONSTRAINT UQ_story_links_app_frId UNIQUE (appSlug, frId)
        )
      END
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'story_links')
        DROP TABLE story_links
    `)
  }
}
