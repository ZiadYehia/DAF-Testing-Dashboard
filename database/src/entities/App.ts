import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('apps')
@Unique(['slug'])
export class App {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  slug!: string

  @Column({ type: 'nvarchar', length: 200 })
  name!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  description!: string

  @Column({ type: 'nvarchar', length: 50, default: '' })
  icon!: string

  @Column({ type: 'bit', default: true })
  enabled!: boolean

  @Column({ type: 'varchar', length: 10, default: 'web' })
  type!: string

  @Column({ type: 'nvarchar', length: 200, default: '' })
  platform!: string

  @Column({ type: 'nvarchar', length: 'max', default: '{}' })
  capabilities!: string

  @CreateDateColumn({ type: 'datetime2', nullable: true })
  createdAt!: Date | null

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
