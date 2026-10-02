import type { User } from '@prisma/client'
import type { UserDTO } from '@balance/contracts'

export function userToDTO(u: User): UserDTO {
  return { id: u.id, name: u.name, email: u.email, image: u.image, timezone: u.timezone }
}
