import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUserStories1700000000005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_stories')
      BEGIN
        CREATE TABLE user_stories (
          id INT IDENTITY(1,1) NOT NULL,
          appSlug VARCHAR(50) NOT NULL,
          storyKey VARCHAR(100) NOT NULL,
          summary NVARCHAR(MAX) NOT NULL DEFAULT '',
          description NVARCHAR(MAX) NOT NULL DEFAULT '',
          status VARCHAR(50) NOT NULL DEFAULT '',
          labels NVARCHAR(MAX) NOT NULL DEFAULT '[]',
          components NVARCHAR(MAX) NOT NULL DEFAULT '[]',
          CONSTRAINT PK_user_stories PRIMARY KEY (id),
          CONSTRAINT UQ_user_stories_app_key UNIQUE (appSlug, storyKey)
        )
      END
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'user_stories')
        DROP TABLE user_stories
    `)
  }
}
