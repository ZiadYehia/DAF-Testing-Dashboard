import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, UpdateDateColumn } from 'typeorm'
import { Feature } from './Feature'

@Entity('test_executions')
@Unique(['feature', 'version', 'testcaseId'])
export class TestExecution {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Feature, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'featureId' })
  feature!: Feature

  @Column({ type: 'varchar', length: 50 })
  testcaseId!: string

  @Column({ type: 'varchar', length: 20, default: 'new_added' })
  status!: string

  @Column({ type: 'int', nullable: true })
  version!: number | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  bugSlug!: string | null

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  notes!: string | null

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
