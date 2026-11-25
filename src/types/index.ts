export type ContentType = 'game' | 'app' | 'project' | 'book' | 'podcast';

export type GameDeliveryType = 'apk' | 'web_game' | 'external';
export type GameLaunchMode = 'internal_embed' | 'internal_page' | 'external_url' | 'apk_download';

export type AccessAudience = 'public' | 'members' | 'approved';
export type PublicationStatus = 'published' | 'draft' | 'archived';

export interface NewBadgeConfig {
  enabled: boolean;
  label: string;
  activeDate?: string;
  expireDate?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  summary: string;
  type: ContentType;
  category: string;
  coverImage: string;
  galleryImages: string[];
  bannerImage?: string;
  status: PublicationStatus;
  createdAt: string;
  updatedAt: string;
  creator: string;
  isFeatured: boolean;
  isEditorsPick?: boolean;
  audience: AccessAudience;
  tags: string[];
  likesCount: number;
  viewsCount: number;
  downloadsCount: number;
  commentsEnabled: boolean;
  newBadge?: NewBadgeConfig;
  customFields?: Record<string, string | number | boolean>;
  
  // Per-type deep configurations
  gameConfig?: {
    deliveryType: GameDeliveryType;
    launchMode: GameLaunchMode;
    webGameUrl?: string;
    apkUrl?: string;
    externalUrl?: string;
    downloadUrl?: string;
    fileSize?: string;
    version?: string;
    releaseDate?: string;
    systemReqs?: string;
    platform?: string;
    supportedPlatforms?: string[];
    genre?: string;
    videoUrl?: string;
  };
  appConfig?: {
    version?: string;
    supportedOS?: string;
    downloadUrl?: string;
    changelog?: string;
    webDemoUrl?: string;
  };
  projectConfig?: {
    techStack?: string[];
    role?: string;
    repoUrl?: string;
    liveDemoUrl?: string;
    status?: string;
  };
  bookConfig?: {
    author?: string;
    publisher?: string;
    pageCount?: number;
    language?: string;
    readingLink?: string;
    downloadLink?: string;
  };
  podcastConfig?: {
    episodeNumber?: number;
    duration?: string;
    audioUrl?: string;
    videoUrl?: string;
    host?: string;
    showNotes?: string;
  };
}

export type SectionLayoutType = 'carousel' | 'editorial' | 'bento' | 'grid' | 'media_showcase';
export type SectionFilterType = 'all' | 'featured' | 'fresh_drops' | 'hidden_gems' | 'editors_picks' | 'category' | 'custom';

export interface SectionConfig {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  coverImage?: string;
  bannerImage?: string;
  accentColor: string;
  layoutType: SectionLayoutType;
  filterType: SectionFilterType;
  categoryTarget?: string;
  customItemIds?: string[];
  sortOrder: number;
  isEnabled: boolean;
  isDraft: boolean;
  audience: AccessAudience;
}

export type UserRole = 'admin' | 'member' | 'approved';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  isApproved: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  privacySettings: {
    showFavorites: boolean;
    showActivity: boolean;
  };
}

export interface CommentItem {
  id: string;
  contentId: string;
  userId: string;
  username: string;
  userDisplayName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  parentId?: string;
  isApproved: boolean;
  isReported: boolean;
  reportReason?: string;
  likesCount: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  linkUrl: string;
  type: 'system' | 'reply' | 'release' | 'announcement';
  isRead: boolean;
  createdAt: string;
}

export interface PlatformSettings {
  brandName: string;
  brandTagline: string;
  primaryAccent: string;
  showIntroAnimation: boolean;
  allowGuestInteractions: boolean;
  commentModerationRequired: boolean;
  maintenanceMode: boolean;
}

export interface PlatformAnalytics {
  totalItems: number;
  itemsByType: Record<ContentType, number>;
  totalUsers: number;
  totalComments: number;
  totalLikes: number;
  totalViews: number;
  totalDownloads: number;
  pendingModerationCount: number;
  reportedCommentsCount: number;
}

export interface GameCategory {
  id: string;
  name: string;
  slug: string;
  type?: ContentType;
  description?: string;
  itemCount?: number;
}

export interface LikeItem {
  id: string;
  contentId: string;
  userId: string;
  createdAt: string;
}

export interface FavoriteItem {
  id: string;
  userId: string;
  contentId: string;
  createdAt: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  pointsReward: number;
  category: 'play' | 'social' | 'multiplayer' | 'collector';
  requirementType: 'games_played' | 'wins_count' | 'comments_count' | 'favorites_count' | 'points_total' | 'rooms_joined';
  requirementTarget: number;
  isActive: boolean;
}

export interface UserStats {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  points: number;
  xp: number;
  level: number;
  gamesPlayed: number;
  winsCount: number;
  unlockedAchievements: string[];
  isOnline: boolean;
  currentRoomId?: string;
  lastSeenAt: string;
  updatedAt: string;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface GameRoom {
  id: string;
  code: string;
  title: string;
  gameId?: string;
  gameTitle: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  maxPlayers: number;
  isPrivate: boolean;
  playerCount: number;
  winnerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  displayName: string;
  avatarUrl?: string;
  isReady: boolean;
  score: number;
  joinedAt: string;
  lastPingAt: string;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface LocalMigrationSnapshot {
  settings: PlatformSettings;
  users: UserProfile[];
  items: ContentItem[];
  sections: SectionConfig[];
  categories: GameCategory[];
  comments: CommentItem[];
  notifications: NotificationItem[];
}
