import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('modules')
@Unique(['appSlug', 'slug'])
export class Module {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 50 })
  slug!: string

  @Column({ type: 'nvarchar', length: 200 })
  name!: string

  @Column({ type: 'nvarchar', length: 50, default: '' })
  icon!: string

  @Column({ type: 'int', default: 0 })
  sortOrder!: number

  @Column({ type: 'varchar', length: 100, default: '' })
  pathPrefix!: string

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  description!: string | null
}
