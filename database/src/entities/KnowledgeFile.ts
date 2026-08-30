import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('knowledge_files')
@Unique(['appSlug', 'module', 'filename'])
export class KnowledgeFile {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 500 })
  filename!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  content!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null

  @Column({ type: 'varchar', length: 20, default: 'knowledge' })
  docType!: string

  @Column({ type: 'bit', default: false })
  generatedFromIntake!: boolean

  @Column({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
