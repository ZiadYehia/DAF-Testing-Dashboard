import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn } from 'typeorm'
import { Feature } from './Feature'

@Entity('testcase_versions')
@Unique(['feature', 'version'])
export class TestcaseVersion {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Feature, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'featureId' })
  feature!: Feature

  @Column({ type: 'int' })
  version!: number

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  content!: string

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date
}
