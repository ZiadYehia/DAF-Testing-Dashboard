import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('user_stories')
@Unique(['appSlug', 'storyKey'])
export class UserStory {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 100 })
  storyKey!: string

  @Column({ type: 'nvarchar', length: 'max' as unknown as number, default: '' })
  summary!: string

  @Column({ type: 'nvarchar', length: 'max' as unknown as number, default: '' })
  description!: string

  @Column({ type: 'varchar', length: 50, default: '' })
  status!: string

  @Column({ type: 'nvarchar', length: 'max' as unknown as number, default: '[]' })
  labels!: string

  @Column({ type: 'nvarchar', length: 'max' as unknown as number, default: '[]' })
  components!: string
}
