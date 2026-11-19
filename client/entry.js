import { Session } from 'dsh-official-session'
import { RemoteStream } from 'dsh-official-stream'
import { RemoteStreamMuxClient, RemoteStreamCarrierError } from 'dsh-official-mux'
import { createScope } from '@deepseek-ai/dsh-api-session-controller/client'
import { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { projectRemoteEventRejection } from '@deepseek-ai/dsh-api-gateway/stream-protocol'
import { ClientAccessState } from 'dsh-official-access'
import { whenAllowed } from 'dsh-official-when-allowed'
import { createHostTransport } from './transport.js'
import createPlugin from './source.js'

export default createPlugin({ Session, ModelDirectory, RemoteStream, RemoteStreamMuxClient, RemoteStreamCarrierError, RemoteError, ClientAccessState, whenAllowed, createScope, createHostTransport, projectRemoteEventRejection })
