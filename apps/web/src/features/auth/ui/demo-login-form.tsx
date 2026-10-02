import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'
import { useDemoLogin } from '../model/use-auth-actions'

/** Вход без пароля — доступен только в dev-окружении (решает сервер) */
export function DemoLoginForm() {
  const [name, setName] = useState('')
  const login = useDemoLogin()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!login.isPending) login.mutate(name)
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="demo-name">Демо-вход (только для разработки)</FieldLabel>
          <Input
            id="demo-name"
            placeholder="Имя (необязательно)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <FieldDescription className="text-xs">
            Без имени — демо-аккаунт с заполненными задачами, бюджетом и группой. С именем — пустой аккаунт,
            удобно проверять семейные группы вдвоём.
          </FieldDescription>
        </Field>
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="h-11 w-full"
          disabled={login.isPending}
        >
          {login.isPending && <Spinner />}
          Открыть демо
        </Button>
      </FieldGroup>
    </form>
  )
}
