import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 255 })
  email!: string

  @Column({ type: 'varchar', length: 72 })
  passwordHash!: string

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Column({ type: 'varchar', length: 10, default: 'member' })
  role!: string

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
