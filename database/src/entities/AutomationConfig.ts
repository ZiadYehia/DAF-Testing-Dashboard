import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('automation_configs')
@Unique(['appSlug'])
export class AutomationConfig {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 200, default: '' })
  baseUrlEnv!: string

  @Column({ type: 'nvarchar', length: 'max', default: '[]' })
  credentialEnvs!: string

  @Column({ type: 'nvarchar', length: 'max', default: '[]' })
  login!: string

  @Column({ type: 'bit', default: false })
  generatedFromIntake!: boolean

  @Column({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
