import { handleRequest, type EngineRequest } from './engineMessages.ts'

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  self.postMessage(handleRequest(event.data))
}
