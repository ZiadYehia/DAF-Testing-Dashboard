import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('requirements')
@Unique(['appSlug', 'module'])
export class Requirement {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  content!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null
}
