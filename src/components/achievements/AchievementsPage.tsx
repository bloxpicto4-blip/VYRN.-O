import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles, Lock, CheckCircle2, Award, Users, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AchievementDefinition, UserStats } from '../../types';
import {
  getAchievementsFromFirestore,
  subscribeLeaderboard,
} from '../../lib/firestoreService';

interface AchievementsPageProps {
  onRequireAuth: () => void;
}

export const AchievementsPage: React.FC<AchievementsPageProps> = ({ onRequireAuth }) => {
  const { currentUser, userStats, isFirebaseAuthenticated } = useAuth();
  const [achievements, setAchievements] = useState<AchievementDefinition[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([]);

  useEffect(() => {
    getAchievementsFromFirestore().then(setAchievements).catch(() => {});
    const unsub = subscribeLeaderboard(setLeaderboard);
    return () => unsub();
  }, []);

  const unlockedSet = new Set(userStats?.unlockedAchievements || []);
  const xpIntoLevel = (userStats?.xp || 0) % 100;

  return (
    <div dir="rtl" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 text-right animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292C25] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#D7FF38]">
            <Trophy className="w-4 h-4" />
            <span>نظام النقاط والإنجازات السحابي (Cloud Firestore)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F2EBDD] font-mono">
            النقاط، الإنجازات، ولوحة المتصدرين
          </h1>
          <p className="text-xs text-[#F2EBDD]/60">
            يتم احتساب جميع النقاط والمستويات والأوسمة مباشرة في Cloud Firestore.
          </p>
        </div>

        {!isFirebaseAuthenticated && (
          <button
            onClick={onRequireAuth}
            className="px-5 py-2.5 bg-[#FF5A1F] hover:bg-[#FF3300] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            سجّل دخولك لحفظ نقاطك وإنجازاتك
          </button>
        )}
      </div>

      {/* Player Progress Summary */}
      {currentUser && userStats && (
        <section className="p-6 bg-[#1C1E19] border border-[#2D3027] rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-2">
            <span className="text-[11px] font-mono text-[#FF5A1F] uppercase">بطاقة اللاعب السحابية</span>
            <h2 className="text-xl font-bold text-[#F2EBDD] font-mono">{userStats.displayName}</h2>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2.5 py-1 bg-[#D7FF38]/15 text-[#D7FF38] rounded-lg font-bold">
                المستوى {userStats.level}
              </span>
              <span className="text-[#F2EBDD]/60 tabular-nums">
                {xpIntoLevel} / 100 XP للمستوى التالي
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#141512] border border-[#292C25] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF5A1F] transition-all duration-300"
                style={{ width: `${Math.min(100, xpIntoLevel)}%` }}
              />
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[#141512] border border-[#272922] rounded-xl">
              <span className="text-[10px] font-mono text-[#F2EBDD]/50 block">النقاط</span>
              <p className="text-xl font-bold font-mono text-[#D7FF38] tabular-nums mt-1">{userStats.points}</p>
            </div>
            <div className="p-4 bg-[#141512] border border-[#272922] rounded-xl">
              <span className="text-[10px] font-mono text-[#F2EBDD]/50 block">جلسات اللعب</span>
              <p className="text-xl font-bold font-mono text-[#F2EBDD] tabular-nums mt-1">{userStats.gamesPlayed}</p>
            </div>
            <div className="p-4 bg-[#141512] border border-[#272922] rounded-xl">
              <span className="text-[10px] font-mono text-[#F2EBDD]/50 block">الانتصارات</span>
              <p className="text-xl font-bold font-mono text-[#FF5A1F] tabular-nums mt-1">{userStats.winsCount}</p>
            </div>
            <div className="p-4 bg-[#141512] border border-[#272922] rounded-xl">
              <span className="text-[10px] font-mono text-[#F2EBDD]/50 block">الإنجازات</span>
              <p className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
                {unlockedSet.size} / {achievements.length}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Achievements Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#F2EBDD] font-mono flex items-center gap-2">
          <Award className="w-5 h-5 text-[#FF5A1F]" />
          <span>الأوسمة والإنجازات المتاحة ({achievements.length})</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);
            return (
              <div
                key={ach.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isUnlocked
                    ? 'bg-[#20231C] border-[#D7FF38]/60 shadow-lg shadow-[#D7FF38]/5'
                    : 'bg-[#181A15] border-[#282B23] opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#F2EBDD] font-mono">{ach.title}</h3>
                    <p className="text-xs text-[#F2EBDD]/60 leading-relaxed">{ach.description}</p>
                  </div>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnlocked
                        ? 'bg-[#D7FF38]/20 text-[#D7FF38]'
                        : 'bg-[#252822] text-[#F2EBDD]/40'
                    }`}
                  >
                    {isUnlocked ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#262921] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#D7FF38] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+{ach.pointsReward} نقطة</span>
                  </span>
                  <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-[#F2EBDD]/40'}>
                    {isUnlocked ? 'مكتمل ✓' : `الهدف: ${ach.requirementTarget}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Real-Time Leaderboard */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#F2EBDD] font-mono flex items-center gap-2">
          <Users className="w-5 h-5 text-[#D7FF38]" />
          <span>لوحة المتصدرين المباشرة ({leaderboard.length})</span>
        </h2>

        {leaderboard.length === 0 ? (
          <div className="p-10 bg-[#181A15] border border-[#272A22] rounded-2xl text-center text-xs text-[#F2EBDD]/50 font-mono">
            لا توجد سجلات متصدرين بعد. سيتم تسجيل كل لاعب بمجرد دخوله عبر Firebase.
          </div>
        ) : (
          <div className="bg-[#1C1E19] border border-[#2D3027] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-[#F2EBDD]/80">
                <thead className="bg-[#161713] text-[#F2EBDD]/50 border-b border-[#292C25] font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">الترتيب</th>
                    <th className="p-3.5">اللاعب</th>
                    <th className="p-3.5">المستوى</th>
                    <th className="p-3.5">النقاط</th>
                    <th className="p-3.5">الانتصارات</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262822]">
                  {leaderboard.map((player, idx) => (
                    <tr key={player.userId} className="hover:bg-[#22241F]">
                      <td className="p-3.5 font-mono font-bold text-[#FF5A1F]">#{idx + 1}</td>
                      <td className="p-3.5 font-bold text-[#F2EBDD] flex items-center gap-2">
                        <Gamepad2 className="w-3.5 h-3.5 text-[#D7FF38]" />
                        <span>{player.displayName}</span>
                      </td>
                      <td className="p-3.5 font-mono">Lv.{player.level}</td>
                      <td className="p-3.5 font-mono font-bold text-[#D7FF38] tabular-nums">{player.points}</td>
                      <td className="p-3.5 font-mono tabular-nums">{player.winsCount}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                            player.isOnline
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-[#252822] text-[#F2EBDD]/40'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${player.isOnline ? 'bg-emerald-400' : 'bg-[#F2EBDD]/30'}`} />
                          <span>{player.isOnline ? 'متصل' : 'غير متصل'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
