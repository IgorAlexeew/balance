import { Plus, User, Users } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useActiveGroup } from '@/entities/family-group'
import { cn } from '@/shared/lib/cn'
import { routes } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

/** Переключение контекста данных: личные или конкретная семейная группа */
export function GroupSwitcher() {
  const navigate = useNavigate()
  const { group: activeGroup, groupId, groups, setActiveGroupId } = useActiveGroup()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 max-w-52 gap-2 font-medium">
          {activeGroup ? <Users className="size-4 text-primary" /> : <User className="size-4 text-primary" />}
          <span className="truncate">{activeGroup ? activeGroup.name : 'Личные данные'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem onClick={() => setActiveGroupId(null)} className={cn(!groupId && 'bg-accent')}>
          <User className="size-4" />
          Личные данные
        </DropdownMenuItem>
        {groups.map((g) => (
          <DropdownMenuItem
            key={g.id}
            onClick={() => setActiveGroupId(g.id)}
            className={cn(groupId === g.id && 'bg-accent')}
          >
            <Users className="size-4" />
            <span className="truncate">{g.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{g.members.length}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate(routes.family)}>
          <Plus className="size-4" />
          Создать или вступить в группу
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
