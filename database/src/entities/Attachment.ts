import 'reflect-metadata'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { Bug } from './Bug'

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Bug, (b) => b.attachments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'bugId' })
  bug!: Bug

  @Column({ type: 'varchar', length: 500 })
  fileName!: string

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string

  @Column({ type: 'varbinary', length: 'max' })
  data!: Buffer

  @CreateDateColumn({ type: 'datetime2' })
  uploadedAt!: Date
}
