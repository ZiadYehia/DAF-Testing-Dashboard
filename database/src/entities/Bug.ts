import 'reflect-metadata'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm'
import { Attachment } from './Attachment'

@Entity('bugs')
@Unique(['appSlug', 'feature', 'slug'])
export class Bug {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 200 })
  feature!: string

  @Column({ type: 'varchar', length: 200 })
  slug!: string

  @Column({ type: 'nvarchar', length: 500 })
  title!: string

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  jiraKey!: string | null

  @Column({ type: 'datetime2', nullable: true })
  reportedAt!: Date | null

  @Column({ type: 'varchar', length: 50, default: '' })
  priority!: string

  @Column({ type: 'varchar', length: 100, default: '' })
  bugType!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  parentKey!: string | null

  @Column({ type: 'varchar', length: 50, default: '' })
  severity!: string

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  layer!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  body!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  jiraStatus!: string | null

  @Column({ type: 'datetime2', nullable: true })
  jiraStatusSyncedAt!: Date | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  jiraReporter!: string | null

  /**
   * Environment this bug was found on, e.g. "ngrok relay"; NULL = not attributed to one
   * (every bug filed before environments were tracked). The same defect on two environments is
   * two rows with distinct slugs, so this is descriptive, not part of any key.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  environment!: string | null

  @Column({ type: 'datetime2', nullable: true })
  deletedAt!: Date | null

  @OneToMany(() => Attachment, (a) => a.bug, { cascade: true })
  attachments!: Attachment[]
}
