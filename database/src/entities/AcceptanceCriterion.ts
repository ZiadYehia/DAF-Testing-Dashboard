import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Feature } from './Feature'

@Entity('acceptance_criteria')
@Unique(['feature', 'criterionKey'])
export class AcceptanceCriterion {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Feature, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'featureId' })
  feature!: Feature

  @Column({ type: 'varchar', length: 50 })
  criterionKey!: string

  @Column({ type: 'nvarchar', length: 'max' })
  text!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  parentId!: string | null

  @Column({ type: 'varchar', length: 20, nullable: true })
  manualCoverage!: string | null

  @Column({ type: 'nvarchar', length: 'max', default: '[]' })
  aiCoveredBy!: string

  @Column({ type: 'datetime2', nullable: true })
  aiAnalyzedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  sortOrder!: number
}
