import 'reflect-metadata'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm'
import { Screenshot } from './Screenshot'

@Entity('features')
@Unique(['appSlug', 'name'])
export class Feature {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 200 })
  name!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  workflow!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  testcases!: string

  @Column({ type: 'datetime2', nullable: true })
  lastModified!: Date | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  jiraKey!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  storyKey!: string | null

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  knowledge!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  testingPhase!: string | null

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  testingSubtasks!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null

  @Column({ type: 'datetime2', nullable: true })
  archivedAt!: Date | null

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  lastAddition!: string | null

  @OneToMany(() => Screenshot, (s) => s.feature, { cascade: true })
  screenshots!: Screenshot[]
}
