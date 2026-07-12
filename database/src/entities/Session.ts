import 'reflect-metadata'
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { User } from './User'

@Entity('sessions')
export class Session {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string

  @Column({ type: 'int' })
  userId!: number

  @Column({ type: 'datetime2' })
  expiresAt!: Date

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user?: User
}
