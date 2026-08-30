import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('intake_documents')
@Unique(['appSlug', 'scopeKind', 'scopeSlug'])
export class IntakeDocument {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 10 })
  scopeKind!: string

  @Column({ type: 'varchar', length: 200, default: '' })
  scopeSlug!: string

  @Column({ type: 'nvarchar', length: 'max', default: '{}' })
  answers!: string

  @Column({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
