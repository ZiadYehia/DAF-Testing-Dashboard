import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAuthTables1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        email        VARCHAR(255)  NOT NULL,
        passwordHash VARCHAR(72)   NOT NULL,
        name         VARCHAR(100)  NOT NULL,
        role         VARCHAR(10)   NOT NULL DEFAULT 'member',
        createdAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt    DATETIME2     NULL,
        CONSTRAINT UQ_users_email UNIQUE (email)
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sessions' AND xtype='U')
      CREATE TABLE sessions (
        id        VARCHAR(36)  NOT NULL,
        userId    INT          NOT NULL,
        expiresAt DATETIME2    NOT NULL,
        createdAt DATETIME2    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_sessions PRIMARY KEY (id),
        CONSTRAINT FK_sessions_user FOREIGN KEY (userId)
          REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='app_memberships' AND xtype='U')
      CREATE TABLE app_memberships (
        id        INT IDENTITY(1,1) PRIMARY KEY,
        userId    INT          NOT NULL,
        appSlug   VARCHAR(50)  NOT NULL,
        role      VARCHAR(10)  NOT NULL DEFAULT 'tester',
        createdAt DATETIME2    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_app_memberships_user FOREIGN KEY (userId)
          REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_app_memberships_user_app UNIQUE (userId, appSlug)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app_memberships`)
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
  }
}
