import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, UpdateDateColumn } from 'typeorm'
import { Feature } from './Feature'

@Entity('test_executions')
@Unique(['feature', 'testcaseId'])
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

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
