import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { User } from './User'

@Entity('app_memberships')
@Unique(['userId', 'appSlug'])
export class AppMembership {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int' })
  userId!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 20, default: 'qa' })
  role!: string

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  permissions!: string | null

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user?: User
}
