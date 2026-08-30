import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Change Request (CR) feature: DB-backed CR list, mirroring the bugs table.
 * A CR always has a parent story or epic (parentKey/parentType) and is
 * optionally pushed to Jira as crKey. Self-contained migration — no imports
 * from src/lib.
 */
export class CreateChangeRequests1700000000028 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='change_requests' AND xtype='U')
      CREATE TABLE change_requests (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        appSlug          VARCHAR(50)   NOT NULL,
        parentKey        VARCHAR(100)  NOT NULL,
        parentType       VARCHAR(10)   NOT NULL,
        crKey            VARCHAR(100)  NULL,
        summary          NVARCHAR(500) NOT NULL,
        description      NVARCHAR(MAX) NOT NULL DEFAULT '',
        changeType       VARCHAR(100)  NOT NULL DEFAULT '',
        priority         VARCHAR(50)   NOT NULL DEFAULT '',
        label            VARCHAR(20)   NOT NULL DEFAULT 'CR',
        jiraStatus       VARCHAR(100)  NULL,
        assignee         VARCHAR(255)  NULL,
        createdByUserId  INT           NULL,
        createdAt        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt        DATETIME2     NULL,
        syncedAt         DATETIME2     NULL,
        CONSTRAINT FK_change_requests_user FOREIGN KEY (createdByUserId)
          REFERENCES users(id) ON DELETE SET NULL
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS change_requests`)
  }
}
