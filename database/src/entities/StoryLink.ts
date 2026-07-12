import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm'

@Entity('story_links')
@Unique(['appSlug', 'frId'])
export class StoryLink {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  @Column({ type: 'varchar', length: 100 })
  frId!: string

  @Column({ type: 'varchar', length: 100, default: '' })
  storyKey!: string
}
