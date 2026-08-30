import 'reflect-metadata'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { Feature } from './Feature'

@Entity('screenshots')
export class Screenshot {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Feature, (f) => f.screenshots, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'featureId' })
  feature!: Feature

  @Column({ type: 'varchar', length: 500 })
  fileName!: string

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string

  @Column({ type: 'varbinary', length: 'max', nullable: true })
  data!: Buffer | null

  @Column({ type: 'int', nullable: true })
  byteSize!: number | null

  @CreateDateColumn({ type: 'datetime2' })
  uploadedAt!: Date
}
