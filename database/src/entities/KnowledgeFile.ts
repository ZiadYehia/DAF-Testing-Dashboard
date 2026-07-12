import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('knowledge_files')
@Unique(['appSlug', 'filename'])
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
}
