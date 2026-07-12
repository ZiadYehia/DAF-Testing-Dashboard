import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique, UpdateDateColumn } from 'typeorm'

@Entity('settings')
@Unique(['scope', 'key'])
export class Setting {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 100 })
  scope!: string

  @Column({ type: 'varchar', length: 200 })
  key!: string

  @Column({ type: 'nvarchar', length: 'max', default: '' })
  value!: string

  @UpdateDateColumn({ type: 'datetime2', nullable: true })
  updatedAt!: Date
}
