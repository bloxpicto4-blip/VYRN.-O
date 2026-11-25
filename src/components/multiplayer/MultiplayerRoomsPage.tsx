import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Plus,
  Play,
  LogOut,
  Send,
  Crown,
  CheckCircle2,
  Circle,
  Trophy,
  KeyRound,
  Lock,
  Globe,
  Gamepad2,
  X,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ContentItem, GameRoom, RoomMessage, RoomPlayer, UserStats } from '../../types';
import { auth } from '../../lib/firebase';
import {
  claimMatchRewardForRoom,
  createRoomInFirestore,
  deleteRoomInFirestore,
  finishRoomMatchInFirestore,
  getContentFromFirestore,
  joinRoomInFirestore,
  leaveRoomInFirestore,
  sendRoomMessageInFirestore,
  setOnlineStatusInFirestore,
  startRoomMatchInFirestore,
  subscribeOnlinePlayers,
  subscribeRoomMessages,
  subscribeRoomPlayers,
  subscribeRooms,
  toggleRoomReadyInFirestore,
  updateMyRoomScoreInFirestore,
} from '../../lib/firestoreService';

interface MultiplayerRoomsPageProps {
  onRequireAuth: () => void;
  onLaunchGame?: (game: ContentItem) => void;
}

interface WsPresencePlayer {
  userId: string;
  displayName: string;
  roomId: string | null;
}

export const MultiplayerRoomsPage: React.FC<MultiplayerRoomsPageProps> = ({
  onRequireAuth,
  onLaunchGame,
}) => {
  const { currentUser, isFirebaseAuthenticated, userStats } = useAuth();
  const { showToast, confirmAction } = useToast();

  const [onlinePlayers, setOnlinePlayers] = useState<UserStats[]>([]);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [gamesCatalog, setGamesCatalog] = useState<ContentItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);

  // Live WebSocket state merged cleanly with Firestore
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [wsOnlineCount, setWsOnlineCount] = useState<number>(0);
  const [wsPresencePlayers, setWsPresencePlayers] = useState<WsPresencePlayer[]>([]);
  const [wsMessages, setWsMessages] = useState<RoomMessage[]>([]);
  const [wsScoreOverrides, setWsScoreOverrides] = useState<Record<string, { score: number; ts: number }>>({});
  const [roomEventsFeed, setRoomEventsFeed] = useState<{ id: string; text: string; ts: number }[]>([]);

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [scoreInput, setScoreInput] = useState<number>(10);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const prevRoomStatusRef = useRef<{ roomId: string; status: string } | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const claimedRoomsRef = useRef<Set<string>>(new Set());
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const myUid = currentUser?.id || '';

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
    prevRoomStatusRef.current = null;
    setWsMessages([]);
    setWsScoreOverrides({});
    setRoomEventsFeed([]);
  }, [activeRoomId]);

  // Real-time Firestore subscriptions for online players & rooms
  useEffect(() => {
    const unsubPlayers = subscribeOnlinePlayers(setOnlinePlayers);
    const unsubRooms = subscribeRooms(setRooms);
    getContentFromFirestore({ type: 'game' })
      .then((items) => setGamesCatalog(items.filter((i) => i.status === 'published')))
      .catch(() => {});

    return () => {
      unsubPlayers();
      unsubRooms();
    };
  }, []);

  // Real-time WebSocket hub connection on /ws with onmessage, heartbeat & auto-reconnect
  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let retryAttempt = 0;

    const markEventSeen = (eventId?: string): boolean => {
      if (!eventId) return false;
      if (seenEventIdsRef.current.has(eventId)) return true;
      seenEventIdsRef.current.add(eventId);
      if (seenEventIdsRef.current.size > 250) {
        const first = seenEventIdsRef.current.values().next().value;
        if (first) seenEventIdsRef.current.delete(first);
      }
      return false;
    };

    const connectWs = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      setWsStatus(retryAttempt > 0 ? 'reconnecting' : 'connecting');

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = async () => {
          if (!isMounted) return;
          retryAttempt = 0;
          setWsStatus('connected');
          const idToken =
            isFirebaseAuthenticated && auth.currentUser
              ? await auth.currentUser.getIdToken().catch(() => undefined)
              : undefined;
          if (!isMounted || !socket || socket.readyState !== WebSocket.OPEN) return;
          socket.send(
            JSON.stringify({
              type: 'presence:hello',
              userId: myUid,
              idToken,
              displayName: currentUser?.displayName || 'زائر',
            })
          );
          if (activeRoomIdRef.current) {
            socket.send(JSON.stringify({ type: 'room:join', roomId: activeRoomIdRef.current }));
          }
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            if (!msg || typeof msg.type !== 'string') return;

            if (msg.type === 'pong') return;

            if (msg.type === 'presence:snapshot') {
              setWsOnlineCount(Number(msg.onlineCount || 0));
              if (Array.isArray(msg.players)) {
                setWsPresencePlayers(
                  msg.players.filter((p: any) => p && typeof p.userId === 'string' && p.userId)
                );
              }
              return;
            }

            if (markEventSeen(msg.eventId)) return;

            if (msg.type === 'room:chat' && msg.roomId === activeRoomIdRef.current) {
              const incomingId = String(msg.id || msg.eventId || `ws_${Date.now()}`);
              const incomingMsg: RoomMessage = {
                id: incomingId,
                roomId: String(msg.roomId),
                userId: String(msg.userId || ''),
                displayName: String(msg.displayName || 'لاعب'),
                content: String(msg.content || msg.text || ''),
                createdAt: String(msg.createdAt || new Date().toISOString()),
              };
              if (!incomingMsg.content) return;
              setWsMessages((prev) => {
                if (prev.some((m) => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
              });
            } else if (msg.type === 'room:score' && msg.roomId === activeRoomIdRef.current) {
              const uid = String(msg.userId || '');
              const nextScore = Number(msg.score);
              const ts = Number(msg.ts || Date.now());
              if (uid && Number.isFinite(nextScore)) {
                setWsScoreOverrides((prev) => ({
                  ...prev,
                  [uid]: { score: nextScore, ts },
                }));
              }
            } else if (msg.type === 'room:event' && msg.roomId === activeRoomIdRef.current) {
              const actor = String(msg.displayName || 'لاعب');
              const label =
                msg.event === 'player_joined'
                  ? `انضم ${actor} إلى الغرفة`
                  : msg.event === 'player_left'
                  ? `غادر ${actor} الغرفة`
                  : '';
              if (label && msg.userId !== myUid) {
                setRoomEventsFeed((prev) => [
                  ...prev.slice(-4),
                  { id: String(msg.eventId || Date.now()), text: label, ts: Date.now() },
                ]);
              }
            } else if (msg.type === 'room:sync' && msg.roomId === activeRoomIdRef.current) {
              if (msg.event === 'match_started' && msg.userId !== myUid) {
                showToast('أطلق المضيف المواجهة الآن!', 'info');
              } else if (msg.event === 'match_finished' && msg.userId !== myUid) {
                showToast('انتهت المباراة! جاري مزامنة النتائج والمكافآت.', 'success');
              }
            }
          } catch {
            // Ignore non-JSON WS message
          }
        };

        socket.onclose = () => {
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
          if (!isMounted) return;
          setWsStatus('reconnecting');
          const delay = Math.min(10000, 1500 * Math.pow(2, retryAttempt));
          retryAttempt = Math.min(4, retryAttempt + 1);
          reconnectTimer = setTimeout(connectWs, delay);
        };
      } catch {
        setWsStatus('reconnecting');
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [myUid, currentUser?.displayName, isFirebaseAuthenticated, showToast]);

  // Firestore 25s presence heartbeat & pagehide cleanup (multi-instance accurate online strip)
  useEffect(() => {
    if (!isFirebaseAuthenticated || !myUid) return;
    setOnlineStatusInFirestore(true, activeRoomIdRef.current || '').catch(() => {});
    const heartbeat = setInterval(() => {
      setOnlineStatusInFirestore(true, activeRoomIdRef.current || '').catch(() => {});
    }, 25000);
    const onPageHide = () => {
      setOnlineStatusInFirestore(false, '').catch(() => {});
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [isFirebaseAuthenticated, myUid]);

  // Cross-instance Firestore room status transition notifications (works even without Redis)
  useEffect(() => {
    if (!activeRoom) return;
    const prev = prevRoomStatusRef.current;
    prevRoomStatusRef.current = { roomId: activeRoom.id, status: activeRoom.status };
    if (!prev || prev.roomId !== activeRoom.id || prev.status === activeRoom.status) return;
    if (activeRoom.hostId === myUid) return;

    if (prev.status === 'waiting' && activeRoom.status === 'playing') {
      const key = `fs_start_${activeRoom.id}`;
      if (!seenEventIdsRef.current.has(key)) {
        seenEventIdsRef.current.add(key);
        showToast('بدأت المواجهة الآن!', 'info');
      }
    } else if (prev.status === 'playing' && activeRoom.status === 'finished') {
      const key = `fs_finish_${activeRoom.id}`;
      if (!seenEventIdsRef.current.has(key)) {
        seenEventIdsRef.current.add(key);
        showToast('انتهت المباراة! جاري احتساب النتائج والمكافآت.', 'success');
      }
    }
  }, [activeRoom?.id, activeRoom?.status, activeRoom?.hostId, myUid, showToast]);

  // Real-time room subcollections (players & messages) when inside a room
  useEffect(() => {
    if (!activeRoomId || !isFirebaseAuthenticated) {
      setRoomPlayers([]);
      setRoomMessages([]);
      return;
    }
    const unsubRoomPlayers = subscribeRoomPlayers(activeRoomId, setRoomPlayers);
    const unsubRoomMessages = subscribeRoomMessages(activeRoomId, setRoomMessages);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:join', roomId: activeRoomId }));
    }

    return () => {
      unsubRoomPlayers();
      unsubRoomMessages();
    };
  }, [activeRoomId, isFirebaseAuthenticated]);

  // Auto-claim match reward for ALL players in a finished room (including non-host winner)
  useEffect(() => {
    if (
      !activeRoom ||
      activeRoom.status !== 'finished' ||
      !isFirebaseAuthenticated ||
      !myUid ||
      !roomPlayers.some((p) => p.id === myUid) ||
      claimedRoomsRef.current.has(activeRoom.id)
    ) {
      return;
    }

    claimedRoomsRef.current.add(activeRoom.id);
    claimMatchRewardForRoom(activeRoom.id)
      .then((awarded) => {
        if (awarded) {
          const won = activeRoom.winnerId === myUid;
          showToast(
            won
              ? 'مبروك الفوز! تم إضافة 120 نقطة و150 XP إلى رصيدك.'
              : 'انتهت المواجهة! تم إضافة 30 نقطة و50 XP لمشاركتك.',
            'success'
          );
        }
      })
      .catch(() => {});
  }, [activeRoom?.id, activeRoom?.status, activeRoom?.winnerId, isFirebaseAuthenticated, myUid, roomPlayers, showToast]);

  const requireFirebaseSession = () => {
    if (!currentUser || !isFirebaseAuthenticated) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFirebaseSession()) return;
    if (!roomTitle.trim()) {
      setErrorMsg('يرجى إدخال اسم الغرفة.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const selectedGame = gamesCatalog.find((g) => g.id === selectedGameId);
      const created = await createRoomInFirestore({
        title: roomTitle.trim(),
        gameId: selectedGame?.id,
        gameTitle: selectedGame?.title || 'ساحة VYRN التنافسية',
        maxPlayers,
        isPrivate,
      });
      setIsCreateOpen(false);
      setRoomTitle('');
      setActiveRoomId(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر إنشاء الغرفة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!requireFirebaseSession()) return;
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await joinRoomInFirestore(roomId);
      setActiveRoomId(roomId);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر الانضمام إلى الغرفة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const match = rooms.find((r) => r.code.toUpperCase() === joinCode.trim().toUpperCase());
    if (!match) {
      setErrorMsg('لم يتم العثور على غرفة بهذا الرمز.');
      return;
    }
    await handleJoinRoom(match.id);
    setJoinCode('');
  };

  const handleLeaveRoom = async () => {
    if (!activeRoomId) return;
    const targetId = activeRoomId;
    setActiveRoomId(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
    }
    await leaveRoomInFirestore(targetId);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId || !chatInput.trim()) return;
    const msg = chatInput.trim().slice(0, 500);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setChatInput('');
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:chat',
            id: msgId,
            content: msg,
            text: msg,
            createdAt: new Date().toISOString(),
          })
        );
      }
      await sendRoomMessageInFirestore(activeRoomId, msg, msgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر إرسال الرسالة.');
    }
  };

  // Merge Firestore + live WebSocket state cleanly with deterministic deduplication
  const mergedRoomPlayers = useMemo(() => {
    return roomPlayers
      .map((p) => {
        const wsOverride = wsScoreOverrides[p.id];
        if (!wsOverride) return p;
        return {
          ...p,
          score: Math.max(p.score, wsOverride.score),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [roomPlayers, wsScoreOverrides]);

  const mergedRoomMessages = useMemo(() => {
    const map = new Map<string, RoomMessage>();
    wsMessages.forEach((m) => map.set(m.id, m));
    roomMessages.forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [wsMessages, roomMessages]);

  const mergedOnlinePlayers = useMemo(() => {
    const map = new Map<string, UserStats>();
    const staleCutoffMs = Date.now() - 120000;
    onlinePlayers.forEach((p) => {
      const lastSeenMs = p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : 0;
      if (!lastSeenMs || lastSeenMs >= staleCutoffMs || p.userId === myUid) {
        map.set(p.userId, p);
      }
    });
    wsPresencePlayers.forEach((wp) => {
      const existing = map.get(wp.userId);
      if (existing) {
        if (wp.roomId && !existing.currentRoomId) {
          map.set(wp.userId, { ...existing, currentRoomId: wp.roomId });
        }
      } else {
        map.set(wp.userId, {
          userId: wp.userId,
          displayName: wp.displayName,
          avatarUrl: '',
          points: 0,
          xp: 0,
          level: 1,
          gamesPlayed: 0,
          winsCount: 0,
          unlockedAchievements: [],
          isOnline: true,
          currentRoomId: wp.roomId || undefined,
          lastSeenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
    return Array.from(map.values());
  }, [onlinePlayers, wsPresencePlayers, myUid]);

  const myPlayerRecord = mergedRoomPlayers.find((p) => p.id === myUid);
  const isHost = Boolean(activeRoom && activeRoom.hostId === myUid);

  return (
    <div dir="rtl" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#292C25] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#D7FF38]">
            <Users className="w-4 h-4" />
            <span>ساحة اللعب الجماعي المتزامنة (Firestore + WebSocket)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F2EBDD] font-mono">
            غرف اللعب الجماعي واللاعبون المتصلون
          </h1>
          <p className="text-xs text-[#F2EBDD]/60">
            أنشئ غرفاً خاصة أو عامة، تحدَّ اللاعبين المتصلين في الوقت الفعلي، واجمع نقاط الخبرة والإنجازات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`px-3 py-2 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 ${
              wsStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>
              {wsStatus === 'connected'
                ? `متصل لحظياً (${Math.max(wsOnlineCount, mergedOnlinePlayers.length)})`
                : 'إعادة الاتصال بالبث المباشر...'}
            </span>
          </div>

          {userStats && (
            <div className="px-3.5 py-2 bg-[#1D1F1A] border border-[#2D3027] rounded-xl text-xs font-mono flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#D7FF38]" />
              <span className="text-[#F2EBDD]/70">رصيدك:</span>
              <span className="font-bold text-[#D7FF38] tabular-nums">{userStats.points} نقطة</span>
            </div>
          )}

          {!activeRoom && (
            <button
              onClick={() => {
                if (requireFirebaseSession()) setIsCreateOpen(true);
              }}
              className="px-4 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#FF5A1F]/25 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء غرفة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-300 font-mono flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Online Players Strip */}
      <section className="p-4 sm:p-5 bg-[#1B1D18] border border-[#2B2E26] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-[#F2EBDD] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>اللاعبون المتصلون الآن ({mergedOnlinePlayers.length})</span>
          </h2>
          {!isFirebaseAuthenticated && (
            <button
              onClick={onRequireAuth}
              className="text-[11px] font-mono text-[#FF5A1F] hover:underline cursor-pointer"
            >
              سجّل دخولك للظهور في القائمة والانضمام للغرف
            </button>
          )}
        </div>

        {mergedOnlinePlayers.length === 0 ? (
          <p className="text-xs text-[#F2EBDD]/50 font-mono py-2">
            لا يوجد لاعبون متصلون مسجلون في هذه اللحظة. كن أول المتصلين بتسجيل الدخول.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {mergedOnlinePlayers.map((p) => (
              <div
                key={p.userId}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#141512] border border-[#2D3027] rounded-xl text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] flex items-center justify-center font-mono font-bold text-[11px]">
                  {p.displayName.charAt(0)}
                </div>
                <span className="font-semibold text-[#F2EBDD]">{p.displayName}</span>
                <span className="text-[10px] font-mono text-[#D7FF38]">Lv.{p.level}</span>
                {p.currentRoomId && (
                  <span className="text-[10px] font-mono text-[#FF5A1F]">· داخل غرفة</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ACTIVE ROOM VIEW OR LOBBY DIRECTORY */}
      {activeRoom ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Room Header & Controls (Left/Top 7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 sm:p-6 bg-[#1C1E19] border border-[#2E3128] rounded-2xl space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#292C25] pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#D7FF38]">
                    <span>رمز الغرفة: {activeRoom.code}</span>
                    <span>·</span>
                    <span>
                      {activeRoom.status === 'waiting'
                        ? 'في انتظار اللاعبين'
                        : activeRoom.status === 'playing'
                        ? 'مباراة جارية الآن'
                        : 'انتهت المباراة'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#F2EBDD] font-mono mt-1">{activeRoom.title}</h2>
                  <p className="text-xs text-[#F2EBDD]/60 mt-0.5 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#FF5A1F]" />
                    <span>{activeRoom.gameTitle}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {activeRoom.gameId && onLaunchGame && (
                    <button
                      onClick={() => {
                        const found = gamesCatalog.find((g) => g.id === activeRoom.gameId);
                        if (found) onLaunchGame(found);
                      }}
                      className="px-3.5 py-2 bg-[#D7FF38] text-[#191A17] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>تشغيل اللعبة</span>
                    </button>
                  )}

                  <button
                    onClick={handleLeaveRoom}
                    className="px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>مغادرة</span>
                  </button>
                </div>
              </div>

              {/* Players Roster */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-mono text-[#F2EBDD]/60 uppercase">
                  اللاعبون المشاركون ({mergedRoomPlayers.length} / {activeRoom.maxPlayers})
                </h3>
                <div className="space-y-2">
                  {mergedRoomPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="p-3 bg-[#141512] border border-[#292C25] rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {player.id === activeRoom.hostId ? (
                          <Crown className="w-4 h-4 text-[#D7FF38]" />
                        ) : player.isReady ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-[#F2EBDD]/30" />
                        )}
                        <span className="font-bold text-[#F2EBDD]">{player.displayName}</span>
                        {player.id === myUid && (
                          <span className="text-[10px] font-mono text-[#FF5A1F]">(أنت)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-[#D7FF38] font-bold tabular-nums">{player.score} pts</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            player.isReady
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-[#252822] text-[#F2EBDD]/50'
                          }`}
                        >
                          {player.isReady ? 'جاهز' : 'ينتظر'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {roomEventsFeed.length > 0 && (
                  <div className="pt-2 space-y-1">
                    {roomEventsFeed.map((evt) => (
                      <div key={evt.id} className="text-[11px] font-mono text-[#D7FF38]/80">
                        • {evt.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Room Action Controls */}
              <div className="pt-3 border-t border-[#292C25] flex flex-wrap items-center justify-between gap-3">
                {activeRoom.status !== 'finished' && myPlayerRecord && (
                  <button
                    onClick={() => toggleRoomReadyInFirestore(activeRoom.id, !myPlayerRecord.isReady)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                      myPlayerRecord.isReady
                        ? 'bg-[#252822] text-[#F2EBDD] border border-[#34382F]'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {myPlayerRecord.isReady ? 'إلغاء الاستعداد' : 'أنا جاهز للعب'}
                  </button>
                )}

                {activeRoom.status === 'playing' && myPlayerRecord && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(Number(e.target.value) || 0)}
                      className="w-20 bg-[#141512] border border-[#2D3028] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EBDD] font-mono"
                    />
                    <button
                      onClick={() => {
                        const nextScore = myPlayerRecord.score + Math.max(0, scoreInput);
                        setWsScoreOverrides((prev) => ({
                          ...prev,
                          [myUid]: { score: nextScore, ts: Date.now() },
                        }));
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                          wsRef.current.send(JSON.stringify({ type: 'room:score', score: nextScore }));
                        }
                        updateMyRoomScoreInFirestore(activeRoom.id, nextScore).catch((err: any) =>
                          showToast(err?.message || 'تعذر حفظ النتيجة.', 'error')
                        );
                      }}
                      className="px-3.5 py-1.5 bg-[#D7FF38] text-[#191A17] text-xs font-bold rounded-lg cursor-pointer"
                    >
                      تسجيل نقاط جولة
                    </button>
                  </div>
                )}

                {isHost && activeRoom.status === 'waiting' && (
                  <button
                    onClick={async () => {
                      await startRoomMatchInFirestore(activeRoom.id);
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'room:sync', event: 'match_started' }));
                      }
                    }}
                    className="px-5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>بدء المواجهة الآن</span>
                  </button>
                )}

                {isHost && activeRoom.status === 'playing' && (
                  <button
                    onClick={async () => {
                      const hasCompetitivePlayers = mergedRoomPlayers.length >= 2;
                      const topPlayer = [...mergedRoomPlayers].sort((a, b) => b.score - a.score)[0];
                      const winnerId = hasCompetitivePlayers ? (topPlayer?.id || '') : '';
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: 'room:sync',
                            event: 'match_finished',
                            winnerId,
                          })
                        );
                      }
                      await finishRoomMatchInFirestore(activeRoom.id, winnerId);
                      if (!hasCompetitivePlayers) {
                        showToast('تم إنهاء الغرفة. تتطلب مكافآت المواجهة وجود لاعبَين على الأقل.', 'info');
                      }
                    }}
                    className="px-5 py-2 bg-[#D7FF38] text-[#191A17] text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>إنهاء المباراة واحتساب الفوز</span>
                  </button>
                )}

                {activeRoom.status === 'finished' && activeRoom.winnerId && (
                  <div className="px-3.5 py-2 bg-[#D7FF38]/15 border border-[#D7FF38]/40 text-[#D7FF38] rounded-xl text-xs font-mono">
                    🏆 الفائز بالمواجهة:{' '}
                    {mergedRoomPlayers.find((p) => p.id === activeRoom.winnerId)?.displayName || 'بطل الساحة'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Room Chat (Right 5 Cols) */}
          <div className="lg:col-span-5 bg-[#1C1E19] border border-[#2E3128] rounded-2xl flex flex-col h-[460px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#292C25] text-xs font-mono font-bold text-[#F2EBDD] flex items-center justify-between">
              <span>دردشة الغرفة الفورية</span>
              <span className="text-[10px] text-[#D7FF38]">
                {wsStatus === 'connected' ? 'مزامنة فورية WS' : 'مزامنة Firestore'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {mergedRoomMessages.length === 0 ? (
                <p className="text-xs text-[#F2EBDD]/40 text-center py-12 font-mono">
                  ابدأ المحادثة مع اللاعبين في هذه الغرفة...
                </p>
              ) : (
                mergedRoomMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl text-xs space-y-1 ${
                      m.userId === myUid
                        ? 'bg-[#FF5A1F]/15 border border-[#FF5A1F]/30'
                        : 'bg-[#141512] border border-[#272922]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#F2EBDD]/50">
                      <span className="font-bold text-[#D7FF38]">{m.displayName}</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[#F2EBDD] leading-relaxed">{m.content}</p>
                  </div>
                ))
              )}
            </div>

            {activeRoom.status !== 'finished' && (
              <form onSubmit={handleSendChat} className="p-3 border-t border-[#292C25] flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="اكتب رسالة للاعبين..."
                  className="flex-1 bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-lg px-3 py-2 text-xs text-[#F2EBDD] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-40 text-white rounded-lg cursor-pointer"
                >
                  <Send className="w-4 h-4 rtl-flip" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Quick Join by Code */}
          <form
            onSubmit={handleJoinByCode}
            className="p-4 bg-[#1C1E19] border border-[#2D3027] rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-xs text-[#F2EBDD]/80 font-mono">
              <KeyRound className="w-4 h-4 text-[#D7FF38]" />
              <span>هل لديك رمز غرفة خاصة؟</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="مثال: A4K9P2"
                className="bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F2EBDD] uppercase focus:outline-none"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="px-4 py-1.5 bg-[#D7FF38] text-[#191A17] text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
              >
                انضمام بالرمز
              </button>
            </div>
          </form>

          {/* Rooms Grid */}
          {rooms.length === 0 ? (
            <div className="p-16 bg-[#181A15] border border-[#272A22] rounded-2xl text-center space-y-4">
              <Gamepad2 className="w-10 h-10 text-[#FF5A1F] mx-auto opacity-80" />
              <h3 className="text-lg font-bold text-[#F2EBDD] font-mono">لا توجد غرف لعب نشطة حالياً</h3>
              <p className="text-xs text-[#F2EBDD]/60 max-w-md mx-auto">
                أنشئ أول غرفة لعب جماعية الآن واختر اللعبة أو نمط الساحة وادعُ اللاعبين المتصلين للانضمام.
              </p>
              <button
                onClick={() => {
                  if (requireFirebaseSession()) setIsCreateOpen(true);
                }}
                className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء أول غرفة</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const canDelete = room.hostId === myUid || currentUser?.role === 'admin';
                return (
                  <div
                    key={room.id}
                    className="p-5 bg-[#1C1E19] border border-[#2D3027] hover:border-[#FF5A1F]/60 rounded-2xl flex flex-col justify-between space-y-4 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            room.status === 'waiting'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : room.status === 'playing'
                              ? 'bg-[#FF5A1F]/15 text-[#FF5A1F]'
                              : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {room.status === 'waiting'
                            ? 'مفتوحة للانضمام'
                            : room.status === 'playing'
                            ? 'قيد اللعب'
                            : 'منتهية'}
                        </span>
                        <span className="flex items-center gap-1 text-[#F2EBDD]/50">
                          {room.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span>#{room.code}</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#F2EBDD] font-mono">{room.title}</h3>
                      <p className="text-xs text-[#D7FF38]">{room.gameTitle}</p>
                      <p className="text-[11px] text-[#F2EBDD]/50">المضيف: {room.hostName}</p>
                    </div>

                    <div className="pt-3 border-t border-[#272922] flex items-center justify-between">
                      <span className="text-xs font-mono text-[#F2EBDD]/70 tabular-nums">
                        {room.playerCount} / {room.maxPlayers} لاعبين
                      </span>

                      <div className="flex items-center gap-2">
                        {canDelete && (
                          <button
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: 'حذف الغرفة',
                                message: `هل تريد إغلاق وحذف غرفة "${room.title}" نهائياً؟`,
                                confirmLabel: 'حذف الغرفة',
                                destructive: true,
                              });
                              if (ok) {
                                deleteRoomInFirestore(room.id).catch((err: any) =>
                                  showToast(err?.message || 'فشل حذف الغرفة.', 'error')
                                );
                              }
                            }}
                            className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg cursor-pointer"
                            title="حذف الغرفة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          disabled={room.status === 'finished' || isSubmitting}
                          onClick={() => handleJoinRoom(room.id)}
                          className="px-4 py-1.5 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {room.status === 'finished' ? 'منتهية' : 'دخول الغرفة'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Room Modal */}
      {isCreateOpen && (
        <div
          onClick={() => setIsCreateOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1C1E19] border border-[#2E3129] rounded-2xl p-6 space-y-5 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#292C25] pb-3">
              <h3 className="text-base font-bold font-mono text-[#F2EBDD]">إنشاء غرفة لعب جماعي</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-[#F2EBDD]/60 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#F2EBDD]/70 mb-1 font-mono">اسم الغرفة *</label>
                <input
                  type="text"
                  required
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="مثال: تحدي الأبطال - جولة مسائية"
                  className="w-full bg-[#141512] border border-[#2D3028] focus:border-[#FF5A1F] rounded-lg p-2.5 text-[#F2EBDD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#F2EBDD]/70 mb-1 font-mono">اختر اللعبة</label>
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                >
                  <option value="">ساحة VYRN التنافسية العامة</option>
                  {gamesCatalog.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F2EBDD]/70 mb-1 font-mono">الحد الأقصى للاعبين</label>
                  <input
                    type="number"
                    min={2}
                    max={16}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Math.min(16, Math.max(2, Number(e.target.value) || 2)))}
                    className="w-full bg-[#141512] border border-[#2D3028] rounded-lg p-2.5 text-[#F2EBDD]"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="accent-[#FF5A1F]"
                    />
                    <span className="text-[#F2EBDD]/80">غرفة برمز دعوة خاص</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-[#F2EBDD]/60 hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#FF5A1F] hover:bg-[#FF3300] disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء وفتح الغرفة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
