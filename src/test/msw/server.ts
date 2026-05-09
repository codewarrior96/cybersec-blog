import { setupServer } from 'msw/node'
import { resendHandlers } from './handlers/resend'

export const server = setupServer(...resendHandlers)
