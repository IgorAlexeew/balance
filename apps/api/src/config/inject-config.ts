import { Inject } from '@nestjs/common'
import { APP_CONFIG } from './app-config'

export const InjectConfig = () => Inject(APP_CONFIG)
