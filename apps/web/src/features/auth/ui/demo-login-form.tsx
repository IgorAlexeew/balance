import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useDemoLogin } from '../model/use-auth-actions'

/** Вход без пароля — доступен только в dev-окружении (решает сервер) */
export function DemoLoginForm() {
  const [name, setName] = useState('')
  const login = useDemoLogin()

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!login.isPending) login.mutate(name)
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="demo-name">Демо-вход (только для разработки)</Label>
        <Input
          id="demo-name"
          placeholder="Имя (необязательно)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="h-11 w-full font-medium"
        disabled={login.isPending}
      >
        {login.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Открыть демо
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Без имени — демо-аккаунт с заполненными задачами, бюджетом и группой. С именем — пустой аккаунт,
        удобно проверять семейные группы вдвоём.
      </p>
    </form>
  )
}
