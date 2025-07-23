
// CodeChat API v2.2.1 - Complete Types
export interface BusinessCreateRequest {
  name: string;
  attributes?: any;
}

export interface BusinessCreateResponse {
  businessId: string;
  name: string;
  businessToken: string;
  attributes: object;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BusinessFindResponse extends BusinessCreateResponse {
  BusinessWebhook?: BusinessWebhook;
}

export interface BusinessWebhook {
  webhookId: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessUpdateRequest {
  name?: string;
  attributes?: any;
}

export interface BusinessOldToken {
  oldToken: string;
}

export interface NewTokenResponse {
  newToken: string;
}

export interface MoveInstanceRequest {
  sourceInstanceId: string;
  businessIdTarget: string;
}

export interface MoveWhatsAppRequest {
  sourceWhatsAppId: string;
  instanceIdTarget: string;
}

// Instance Types
export interface InstanceCreateRequest {
  instanceName?: string;
  externalId?: string;
}

export interface Auth {
  authId: string;
  jwt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InstanceCreateResponse {
  instanceId: string;
  name: string;
  state: 'active' | 'inactive';
  connection: 'open' | 'close' | 'refused';
  createdAt: string;
  deletedAt?: string;
  businessBusinessId: string;
  Auth: Auth;
}

export interface InstanceFindResponse extends InstanceCreateResponse {
  WhatsApp?: WhatsAppResponse;
  Webhook?: WebhookResponse[];
  Business?: IBusinessResponse;
}

export interface WhatsAppResponse {
  whatsappId: string;
  remoteJid: string;
  pictureUrl: string;
  pushName: string;
  createdAt: string;
  instanceInstanceId: string;
}

export interface IBusinessResponse {
  businessId: string;
  name: string;
}

// Connection Types
export interface ProxyRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface InstanceConnectResponse {
  base64: string;
  code: string;
}

export interface InstanceConnectionStateResponse {
  state: 'open' | 'connecting' | 'close' | 'refused';
  statusReason: number;
}

// Profile Update Types
export interface ProfileNameRequest {
  profileName: string;
}

export interface PictureUrlRequest {
  pictureUrl: string;
}

export interface ProfileStatusRequest {
  profileStatus: string;
}

export interface ProfilePrivacyRequest {
  action: 'all' | 'contact_blacklist' | 'contacts' | 'none';
}

// Webhook Types
export interface WebhookCreateRequest {
  name: string;
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
}

export interface WebhookUpdateRequest {
  url?: string;
  enabled?: boolean;
  name: string;
  headers?: Record<string, string>;
}

export interface WebhookEventsRequest {
  qrcodeUpdate?: boolean;
  stateInstance?: boolean;
  messagesSet?: boolean;
  messagesUpsert?: boolean;
  messagesUpdate?: boolean;
  sendMessage?: boolean;
  contactsSet?: boolean;
  contactsUpsert?: boolean;
  contactsUpdate?: boolean;
  presenceUpdate?: boolean;
  chatsSet?: boolean;
  chatsUpdate?: boolean;
  chatsUpsert?: boolean;
  chatsDelete?: boolean;
  groupsUpsert?: boolean;
  groupUpdate?: boolean;
  groupParticipantsUpdate?: boolean;
  connectionUpdate?: boolean;
  callUpsert?: boolean;
  labelAssociation?: boolean;
  labelEdit?: boolean;
}

export interface WebhookResponse {
  name: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
  webhookId: string;
  createdAt: string;
  updatedAt: string;
  instanceInstanceId: string;
  WebhookEvents?: WebhookEventsResponse;
}

export interface WebhookEventsResponse extends WebhookEventsRequest {
  webhookEventsId: string;
  createdAt: string;
  updatedAt: string;
}

// Message Types
export interface MessageOptions {
  delay?: number;
  presence?: 'composing' | 'recording' | 'available' | 'unavailable';
  quoteMessageById?: string;
  groupMention?: GroupMention;
  externalAttributes?: string;
  messageId?: string;
}

export interface GroupMention {
  hidden?: boolean;
  everyone?: boolean;
}

export interface TextMessage {
  text: string;
}

export interface TextMessageRequest {
  recipient: string;
  options?: MessageOptions;
  textMessage: TextMessage;
}

export interface LinkPreviewMessage {
  link: string;
  title: string;
  description?: string;
  text?: string;
  jpegThumbnail?: string;
}

export interface LinkPreviewRequest {
  recipient: string;
  options?: MessageOptions;
  linkPreview: LinkPreviewMessage;
}

export interface MediaMessage {
  mediaType: 'image' | 'video' | 'document' | 'sticker' | 'audio';
  url: string;
  caption?: string;
  fileName?: string;
}

export interface MediaMessageRequest {
  recipient: string;
  options?: MessageOptions;
  mediaMessage: MediaMessage;
}

export interface AudioMessage {
  url: string;
}

export interface AudioMessageRequest {
  recipient: string;
  options?: MessageOptions;
  audioMessage: AudioMessage;
}

export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface LocationMessageRequest {
  recipient: string;
  options?: MessageOptions;
  locationMessage: LocationMessage;
}

export interface ContactMessage {
  fullName: string;
  wuid: string;
  phoneNumber: string;
}

export interface ContactMessageRequest {
  recipient: string;
  options?: MessageOptions;
  contactMessage: ContactMessage[];
}

export interface Button {
  type: string;
  displayText: string;
  id?: string;
  url?: string;
  copyCode?: string;
  phoneNumber?: string;
}

export interface ButtonMessage {
  thumbnailUrl?: string;
  title: string;
  description?: string;
  footer?: string;
  buttons: Button[];
}

export interface ButtonMessageRequest {
  recipient: string;
  options?: MessageOptions;
  buttonsMessage: ButtonMessage;
}

export interface Row {
  header?: string;
  title: string;
  description?: string;
  id?: string;
}

export interface ListSection {
  title: string;
  rows: Row[];
}

export interface Section {
  buttonText: string;
  list: ListSection[];
}

export interface ListMessage {
  thumbnailUrl?: string;
  title: string;
  description?: string;
  footer?: string;
  sections: Section[];
}

export interface ListMessageRequest {
  recipient: string;
  options?: MessageOptions;
  listMessage: ListMessage;
}

export interface ForwardsMessage {
  messageId: string;
  message: Message;
}

export interface ForwardsMessageRequest {
  recipient: string;
  options?: MessageOptions;
  forwardsMessage: ForwardsMessage;
}

export interface Message {
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  participant?: string;
  pushName: string;
  contentType: string;
  content: any;
}

export interface ReactionRequest {
  messageId: string;
  reaction: string;
}

export interface EditMessageRequest {
  messageId: string;
  newText: string;
}

export interface ResponseSendMessage {
  messageId: string;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  keyParticipant?: string;
  pushName: string;
  contentType: string;
  isGroup: boolean;
  content: object;
  source: string;
  messageTimestamp: number;
  createdAt: string;
  instanceInstanceId: string;
  externalAttributes?: string;
}

// Chat Types
export interface ValidateNumbersRequest {
  numbers: string[];
}

export interface ValidateNumbersResponse {
  jid: string;
  exists: boolean;
}

export interface ArchiveChatRequest {
  archive: boolean;
}

export interface MarkAsReadRequest {
  messageIds: string[];
}

export interface SearchMessagesRequest {
  query?: string;
  chatId?: string;
  limit?: number;
  offset?: number;
}

export interface SearchContactsRequest {
  query?: string;
  limit?: number;
}

export interface SearchChatsRequest {
  query?: string;
  limit?: number;
}

export interface RejectCallRequest {
  callId: string;
  callFrom: string;
}

// Group Types
export interface GroupCreateRequest {
  name: string;
  participants: string[];
  description?: string;
}

export interface GroupUpdateRequest {
  name?: string;
  description?: string;
}

export interface GroupParticipantUpdateRequest {
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote';
}

export interface GroupSettingsRequest {
  setting: string;
  value: any;
}

// Socket Types
export interface SocketEventsRequest {
  qrcodeUpdate?: boolean;
  stateInstance?: boolean;
  messagesSet?: boolean;
  messagesUpsert?: boolean;
  messagesUpdate?: boolean;
  sendMessage?: boolean;
  contactsSet?: boolean;
  contactsUpsert?: boolean;
  contactsUpdate?: boolean;
  presenceUpdate?: boolean;
  chatsSet?: boolean;
  chatsUpdate?: boolean;
  chatsUpsert?: boolean;
  chatsDelete?: boolean;
  groupsUpsert?: boolean;
  groupUpdate?: boolean;
  groupParticipantsUpdate?: boolean;
  connectionUpdate?: boolean;
  callUpsert?: boolean;
}

export interface SocketRequest {
  enabled: boolean;
  events: SocketEventsRequest;
}

export interface SocketResponse {
  socketId: string;
  enabled: boolean;
  SocketEvents: SocketEventsRequest;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  instanceInstanceId: string;
}

// MinIO Types
export interface MinIOConfigRequest {
  accessKey: string;
  secretKey: string;
  endpoint: string;
  port?: number;
  useSSL?: boolean;
  bucket: string;
}

export interface MinIOConfigResponse extends MinIOConfigRequest {
  configId: string;
  createdAt: string;
  updatedAt: string;
  instanceInstanceId: string;
}

// Media Types
export interface MediaPrepareRequest {
  messageId: string;
}

export interface MediaDownloadRequest {
  url: string;
  fileName?: string;
}

export interface MediaResponse {
  mediaId: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// Chatwoot Integration Types
export interface ChatwootIntegrationRequest {
  accountId: string;
  token: string;
  url: string;
  signMsg?: boolean;
  reopenConversation?: boolean;
  conversationPending?: boolean;
}

export interface ChatwootIntegrationResponse extends ChatwootIntegrationRequest {
  integrationId: string;
  createdAt: string;
  updatedAt: string;
  instanceInstanceId: string;
}

// Error Response
export interface ResponseError {
  message: object | string[];
  error: string;
  statusCode: number;
}
