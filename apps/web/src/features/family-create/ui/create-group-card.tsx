import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { familyApi, familyKeys, useActiveGroupStore } from '@/entities/family-group'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

export function CreateGroupCard() {
  const queryClient = useQueryClient()
  const setActiveGroupId = useActiveGroupStore((s) => s.setActiveGroupId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () => familyApi.create({ name: name.trim(), description: description.trim() || null }),
    onSuccess: (group) => {
      setName('')
      setDescription('')
      setActiveGroupId(group.id)
      toast.success('Группа создана! Поделитесь кодом приглашения')
      void queryClient.invalidateQueries({ queryKey: familyKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="size-4.5 text-primary" />
          Создать группу
        </CardTitle>
        <CardDescription>Общее пространство для вашей семьи или близких</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && !create.isPending) create.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="family-name">Название</Label>
            <Input
              id="family-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Семья Ивановых"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="family-description">
              Описание <span className="font-normal text-muted-foreground">(необязательно)</span>
            </Label>
            <Textarea
              id="family-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например, совместные планы и покупки"
              rows={2}
              maxLength={300}
            />
          </div>
          <Button type="submit" className="gap-1.5" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Создать
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
