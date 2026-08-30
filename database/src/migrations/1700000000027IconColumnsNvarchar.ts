import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * apps.icon / modules.icon were created as VARCHAR, which cannot hold emoji —
 * values arrived as '?'. Widen to NVARCHAR; db:import re-fills mangled values.
 * The DEFAULT '' constraint must be dropped around ALTER COLUMN and re-added.
 */
export class IconColumnsNvarchar1700000000027 implements MigrationInterface {
  private async alterIcon(queryRunner: QueryRunner, table: string, type: string): Promise<void> {
    await queryRunner.query(`
      DECLARE @df sysname;
      SELECT @df = dc.name FROM sys.default_constraints dc
      JOIN sys.columns c ON c.default_object_id = dc.object_id
      WHERE dc.parent_object_id = OBJECT_ID('${table}') AND c.name = 'icon';
      IF @df IS NOT NULL EXEC('ALTER TABLE ${table} DROP CONSTRAINT [' + @df + ']');
    `)
    await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN icon ${type}(50) NOT NULL`)
    await queryRunner.query(`ALTER TABLE ${table} ADD CONSTRAINT DF_${table}_icon DEFAULT '' FOR icon`)
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.alterIcon(queryRunner, 'apps', 'NVARCHAR')
    await this.alterIcon(queryRunner, 'modules', 'NVARCHAR')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.alterIcon(queryRunner, 'apps', 'VARCHAR')
    await this.alterIcon(queryRunner, 'modules', 'VARCHAR')
  }
}
