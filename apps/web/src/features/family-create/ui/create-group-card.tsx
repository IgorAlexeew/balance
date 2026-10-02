import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { familyApi, familyKeys, useActiveGroupStore } from '@/entities/family-group'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'
import { Textarea } from '@/shared/ui/textarea'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Введите название группы').max(60),
  description: z.string().max(300),
})
type FormValues = z.infer<typeof formSchema>

export function CreateGroupCard() {
  const queryClient = useQueryClient()
  const setActiveGroupId = useActiveGroupStore((s) => s.setActiveGroupId)
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  })

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      familyApi.create({ name: v.name.trim(), description: v.description.trim() || null }),
    onSuccess: (group) => {
      form.reset()
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
        <form noValidate onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <FieldGroup className="gap-3">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="family-name">Название</FieldLabel>
                  <Input
                    {...field}
                    id="family-name"
                    placeholder="Например, Семья Ивановых"
                    maxLength={60}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="family-description">
                    Описание <span className="font-normal text-muted-foreground">(необязательно)</span>
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="family-description"
                    placeholder="Например, совместные планы и покупки"
                    rows={2}
                    maxLength={300}
                  />
                </Field>
              )}
            />
            <Field orientation="horizontal">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Spinner /> : <Plus className="size-4" />}
                Создать
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
