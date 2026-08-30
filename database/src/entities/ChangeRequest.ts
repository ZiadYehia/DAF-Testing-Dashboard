import 'reflect-metadata'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from './User'

@Entity('change_requests')
export class ChangeRequest {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 100 })
  parentKey!: string

  @Column({ type: 'varchar', length: 10 })
  parentType!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  crKey!: string | null

  @Column({ type: 'nvarchar', length: 500 })
  summary!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  description!: string

  @Column({ type: 'varchar', length: 100, default: '' })
  changeType!: string

  @Column({ type: 'varchar', length: 50, default: '' })
  priority!: string

  @Column({ type: 'varchar', length: 20, default: 'CR' })
  label!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  jiraStatus!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignee!: string | null

  @Column({ type: 'int', nullable: true })
  createdByUserId!: number | null

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null

  @Column({ type: 'datetime2', nullable: true })
  syncedAt!: Date | null

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser?: User | null
}
