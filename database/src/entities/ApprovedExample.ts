import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Feature } from './Feature'

/**
 * A human-approved test-case table promoted into the few-shot "gold" pool.
 * The AI prefers these over the static data/{app}/examples/ files when building
 * test-case prompts, so the system improves as testers approve good output.
 */
@Entity('approved_examples')
export class ApprovedExample {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Feature, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'featureId' })
  feature!: Feature

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  content!: string

  /** How it entered the pool: 'approved' (explicit) or 'edited' (reserved for future use). */
  @Column({ type: 'varchar', length: 20, default: 'approved' })
  source!: string

  /** The testcase version number this was promoted from, if any. */
  @Column({ type: 'int', nullable: true })
  sourceVersion!: number | null

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date
}
