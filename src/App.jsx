
import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Flame,
  Calendar as CalendarIcon,
  Timer,
  Target,
  BarChart3,
  Settings,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Search,
  ArrowRight,
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  Undo2,
  Redo2,
  X,
  Menu,
  Columns,
  List,
  Sparkles,
  CalendarDays,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const playChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {
    console.warn('Audio feedback blocked or not supported', e);
  }
};

const STORAGE_KEY = 'lifeos_suite_data_v3';

const getISODateStr = (date = new Date()) => {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const getRelativeDateStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return getISODateStr(d);
};

const INITIAL_DATA = {
  userName: 'Ali',
  theme: 'dark',
  focusGoalMinutes: 120,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  tasks: [],
  habits: [],
  events: [],
  goals: [],
  focusSessions: []
};

export const computeHabitStreaks = (habit) => {
  const { scheduleDays = [0, 1, 2, 3, 4, 5, 6], completions = [] } = habit;
  const compSet = new Set(completions);

  let currentStreak = 0;
  let longestStreak = habit.bestStreak || 0;
  let tempStreak = 0;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = getISODateStr(today);
  const isScheduledToday = scheduleDays.includes(today.getDay());

  // Determine habit start date: don't count missing days prior to creation
  let startDateStr = habit.startDate;
  if (!startDateStr && habit.createdAt) {
    startDateStr = getISODateStr(new Date(habit.createdAt));
  }
  if (!startDateStr && completions.length > 0) {
    startDateStr = [...completions].sort()[0];
  }
  if (!startDateStr) {
    startDateStr = todayStr;
  }

  let cursor = new Date(today);
  // If scheduled today and not yet completed, give the user the benefit of today:
  // evaluate the ongoing streak from the previous scheduled day.
  if (isScheduledToday && !compSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let backtrackSafety = 365;
  while (backtrackSafety > 0) {
    const curStr = getISODateStr(cursor);
    const dayOfWeek = cursor.getDay();
    const isScheduled = scheduleDays.includes(dayOfWeek);

    // If cursor reaches before the habit was started, stop cleanly
    if (startDateStr && curStr < startDateStr) {
      break;
    }

    if (isScheduled) {
      if (compSet.has(curStr)) {
        currentStreak++;
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
    backtrackSafety--;
  }

  const scanCursor = new Date(today);
  scanCursor.setDate(scanCursor.getDate() - 365);
  scanCursor.setHours(12, 0, 0, 0);
  const endScan = new Date(today);

  while (scanCursor <= endScan) {
    const curStr = getISODateStr(scanCursor);
    const dayOfWeek = scanCursor.getDay();
    const isScheduled = scheduleDays.includes(dayOfWeek);

    if (isScheduled) {
      if (compSet.has(curStr)) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    scanCursor.setDate(scanCursor.getDate() + 1);
  }

  longestStreak = Math.max(longestStreak, currentStreak);
  return { currentStreak, longestStreak };
};

export const getHabitTrackDays = (habit, maxDays = 30) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = getISODateStr(today);

  let startDateStr = habit.startDate;
  if (!startDateStr && habit.createdAt) {
    startDateStr = getISODateStr(new Date(habit.createdAt));
  }
  if (!startDateStr && habit.completions && habit.completions.length > 0) {
    const sorted = [...habit.completions].sort();
    startDateStr = sorted[0];
  }
  if (!startDateStr) {
    startDateStr = todayStr;
  }

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd, 12, 0, 0, 0);

  // If start date is in the future, clamp to today
  const effectiveStart = startDate > today ? today : startDate;
  const diffMs = today.getTime() - effectiveStart.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // Show days from start date up to today (max 30 days window)
  const count = Math.min(diffDays + 1, maxDays);

  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      dateStr: getISODateStr(d),
      dayNum: d.getDate(),
      dayOfWeek: d.getDay()
    });
  }
  return days;
};


export const checkEventConflicts = (events) => {
  const conflictIds = new Set();
  const sorted = [...events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const e1 = sorted[i];
      const e2 = sorted[j];
      if (e1.date !== e2.date) break;

      if (e1.startTime < e2.endTime && e1.endTime > e2.startTime) {
        conflictIds.add(e1.id);
        conflictIds.add(e2.id);
      }
    }
  }
  return conflictIds;
};

const LifeOSContext = createContext(null);

const MAX_HISTORY = 15;

const appReducer = (state, action) => {
  let newState;

  switch (action.type) {

    case 'ADD_TASK': {
      newState = { ...state, tasks: [action.payload, ...state.tasks] };
      break;
    }
    case 'UPDATE_TASK': {
      newState = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload } : t))
      };
      break;
    }
    case 'DELETE_TASK': {
      newState = {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload)
      };
      break;
    }
    case 'TOGGLE_TASK_STATUS': {
      newState = {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id === action.payload) {
            const nextStatus = t.status === 'Done' ? 'Todo' : 'Done';
            return { ...t, status: nextStatus };
          }
          return t;
        })
      };
      break;
    }

    case 'ADD_HABIT': {
      newState = { ...state, habits: [...state.habits, action.payload] };
      break;
    }
    case 'UPDATE_HABIT': {
      newState = {
        ...state,
        habits: state.habits.map((h) => (h.id === action.payload.id ? { ...h, ...action.payload } : h))
      };
      break;
    }
    case 'DELETE_HABIT': {
      newState = {
        ...state,
        habits: state.habits.filter((h) => h.id !== action.payload)
      };
      break;
    }
    case 'TOGGLE_HABIT_DATE': {
      const { habitId, dateStr } = action.payload;
      newState = {
        ...state,
        habits: state.habits.map((h) => {
          if (h.id !== habitId) return h;
          const exists = h.completions.includes(dateStr);
          const newComps = exists
            ? h.completions.filter((d) => d !== dateStr)
            : [...h.completions, dateStr];
          const habitWithComps = { ...h, completions: newComps };
          const { longestStreak, currentStreak } = computeHabitStreaks(habitWithComps);
          const bestStreak = Math.max(h.bestStreak || 0, longestStreak, currentStreak);
          return { ...habitWithComps, bestStreak };
        })
      };
      break;
    }

    case 'ADD_EVENT': {
      newState = { ...state, events: [...state.events, action.payload] };
      break;
    }
    case 'UPDATE_EVENT': {
      newState = {
        ...state,
        events: state.events.map((e) => (e.id === action.payload.id ? { ...e, ...action.payload } : e))
      };
      break;
    }
    case 'DELETE_EVENT': {
      newState = {
        ...state,
        events: state.events.filter((e) => e.id !== action.payload)
      };
      break;
    }

    case 'ADD_GOAL': {
      newState = { ...state, goals: [...state.goals, action.payload] };
      break;
    }
    case 'UPDATE_GOAL': {
      newState = {
        ...state,
        goals: state.goals.map((g) => (g.id === action.payload.id ? { ...g, ...action.payload } : g))
      };
      break;
    }
    case 'DELETE_GOAL': {
      newState = {
        ...state,
        goals: state.goals.filter((g) => g.id !== action.payload)
      };
      break;
    }
    case 'TOGGLE_MILESTONE': {
      const { goalId, milestoneId } = action.payload;
      newState = {
        ...state,
        goals: state.goals.map((g) => {
          if (g.id !== goalId) return g;
          const newMilestones = g.milestones.map((m) =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          );
          return { ...g, milestones: newMilestones };
        })
      };
      break;
    }

    case 'RECORD_FOCUS_SESSION': {
      newState = {
        ...state,
        focusSessions: [action.payload, ...state.focusSessions]
      };
      break;
    }

    case 'SET_THEME': {
      newState = { ...state, theme: action.payload };
      break;
    }
    case 'UPDATE_SETTINGS': {
      newState = { ...state, ...action.payload };
      break;
    }
    case 'LOAD_BACKUP': {
      return {
        ...action.payload,
        history: [],
        future: []
      };
    }
    case 'RESET_DEFAULTS': {
      return {
        ...INITIAL_DATA,
        history: [],
        future: []
      };
    }

    case 'UNDO': {
      if (!state.history || state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, state.history.length - 1);
      const currentData = {
        tasks: state.tasks,
        habits: state.habits,
        events: state.events,
        goals: state.goals,
        focusSessions: state.focusSessions
      };
      return {
        ...state,
        ...previous,
        history: newHistory,
        future: [currentData, ...(state.future || [])]
      };
    }
    case 'REDO': {
      if (!state.future || state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentData = {
        tasks: state.tasks,
        habits: state.habits,
        events: state.events,
        goals: state.goals,
        focusSessions: state.focusSessions
      };
      return {
        ...state,
        ...next,
        history: [...(state.history || []), currentData],
        future: newFuture
      };
    }

    default:
      return state;
  }

  let resultState = newState;
  if (['ADD_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'TOGGLE_TASK_STATUS', 'ADD_HABIT', 'UPDATE_HABIT', 'DELETE_HABIT', 'TOGGLE_HABIT_DATE', 'ADD_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT', 'ADD_GOAL', 'UPDATE_GOAL', 'DELETE_GOAL', 'TOGGLE_MILESTONE', 'RECORD_FOCUS_SESSION'].includes(action.type)) {
    const snapshot = {
      tasks: state.tasks,
      habits: state.habits,
      events: state.events,
      goals: state.goals,
      focusSessions: state.focusSessions
    };
    const updatedHistory = [...(state.history || []), snapshot].slice(-MAX_HISTORY);
    resultState = {
      ...newState,
      history: updatedHistory,
      future: []
    };
  }

  saveToLocalStorage(resultState);
  return resultState;
};

const saveToLocalStorage = (data) => {
  if (!data) return;
  try {
    const dataToSave = {
      userName: data.userName || 'Ali',
      theme: data.theme,
      focusGoalMinutes: data.focusGoalMinutes,
      pomodoroWork: data.pomodoroWork,
      pomodoroBreak: data.pomodoroBreak,
      tasks: data.tasks,
      habits: data.habits,
      events: data.events,
      goals: data.goals,
      focusSessions: data.focusSessions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Failed writing state to localStorage', e);
  }
};

export const LifeOSProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, INITIAL_DATA, () => {
    try {
      localStorage.removeItem('lifeos_suite_data_v2');
      localStorage.removeItem('lifeos_suite_data');
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_DATA, ...parsed, history: [], future: [] };
      }
    } catch (e) {
      console.error('Failed reading initial state from localStorage', e);
    }
    return { ...INITIAL_DATA, history: [], future: [] };
  });

  useEffect(() => {
    saveToLocalStorage(state);
    const handleBeforeUnload = () => {
      saveToLocalStorage(state);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [state]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  return (
    <LifeOSContext.Provider value={{ state, dispatch }}>
      {children}
    </LifeOSContext.Provider>
  );
};

export const useLifeOS = () => {
  const context = useContext(LifeOSContext);
  if (!context) throw new Error('useLifeOS must be used within a LifeOSProvider');
  return context;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
};

const DashboardModule = ({ onNavigate, onLaunchFocusTask, focusTimerState, onStartFocus }) => {
  const { state, dispatch } = useLifeOS();
  const todayStr = getISODateStr();

  const totalTasks = state.tasks.length;
  const completedTasks = state.tasks.filter((t) => t.status === 'Done').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedTodayFocusMins = state.focusSessions
    .filter((fs) => fs.date === todayStr)
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const isTimerActive =
    focusTimerState?.isRunning &&
    (focusTimerState?.mode === 'focus' || focusTimerState?.mode === 'custom');

  const activeFocusSecs = isTimerActive ? Math.max(0, focusTimerState.elapsedSeconds || 0) : 0;
  const activeFocusMins = Math.floor(activeFocusSecs / 60);

  const todayFocusMins = completedTodayFocusMins + activeFocusMins;
  const focusTarget = state.focusGoalMinutes || 120;
  const focusPercent = Math.min(
    100,
    Math.round(((todayFocusMins * 60 + (activeFocusSecs % 60)) / (focusTarget * 60)) * 100)
  );

  const todayDayOfWeek = new Date().getDay();
  const scheduledHabitsToday = state.habits.filter((h) =>
    h.scheduleDays ? h.scheduleDays.includes(todayDayOfWeek) : true
  );
  const completedHabitsToday = scheduledHabitsToday.filter((h) =>
    h.completions.includes(todayStr)
  ).length;

  const maxStreak = state.habits.reduce((max, h) => {
    const s = computeHabitStreaks(h).currentStreak || 0;
    return Math.max(max, s);
  }, 0);

  const todayEvents = state.events.filter((e) => e.date === todayStr);
  const todayTasks = state.tasks.filter((t) => t.dueDate === todayStr);
  const conflictIds = useMemo(() => checkEventConflicts(state.events), [state.events]);

  const past7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = getISODateStr(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayMins = state.focusSessions
        .filter((fs) => fs.date === str)
        .reduce((sum, item) => sum + item.durationMinutes, 0);

      const dayTasks = state.tasks.filter((t) => t.dueDate === str && t.status === 'Done').length;

      days.push({ str, dayName, mins: dayMins, tasks: dayTasks });
    }
    return days;
  }, [state.focusSessions, state.tasks]);

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  const liveDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const weeklyScore = totalTasks === 0 && todayFocusMins === 0 
    ? 100 
    : Math.min(100, Math.max(40, Math.round((taskCompletionRate * 0.5) + (focusPercent * 0.5))));

  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (focusPercent / 100) * ringCircumference;

  return (
    <div className="space-y-6">

      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-slate-900 border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-md flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" /> LifeOS Suite
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                Live date: {liveDateFormatted}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              {timeGreeting}
            </h1>
            <p className="text-zinc-300/80 text-sm mt-1 max-w-lg">
              Your personal operating workspace is ready. Focus on what matters most today.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('tasks')}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} /> New Task
            </button>
            <button
              onClick={() => {
                if (onStartFocus) onStartFocus();
                else onNavigate('focus');
              }}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs sm:text-sm backdrop-blur-md transition border border-white/10 hover:border-white/20"
            >
              <Play size={14} className="fill-white" /> {isTimerActive ? 'Active Focus' : 'Start Focus'}
            </button>
            <button
              onClick={() => onNavigate('goals')}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-xs sm:text-sm backdrop-blur-md transition border border-white/5 hover:border-white/10"
            >
              <Target size={15} /> Add Goal
            </button>
            <button
              onClick={() => onNavigate('analytics')}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-xs sm:text-sm backdrop-blur-md transition border border-white/5 hover:border-white/10"
            >
              <BarChart3 size={15} /> Review
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        <div
          onClick={() => onNavigate('focus')}
          className="cursor-pointer glass-card p-4 sm:p-5 rounded-2xl group relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Focus Time</span>
            {isTimerActive ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] font-bold tracking-tight">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                <span className="text-zinc-900 dark:text-white font-mono">
                  ({Math.floor(focusTimerState.remainingSeconds / 60)}:{String(focusTimerState.remainingSeconds % 60).padStart(2, '0')})
                </span>
              </span>
            ) : (
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-baseline gap-2">
                <span>
                  {todayFocusMins > 0
                    ? `${Math.floor(todayFocusMins / 60)}h ${todayFocusMins % 60}m`
                    : (activeFocusSecs > 0 ? `${activeFocusSecs}s` : '0m')}
                </span>
                {isTimerActive && (
                  <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 animate-pulse">
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {todayFocusMins}m / Daily Goal {Math.round(focusTarget / 60)}h
              </p>
            </div>
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
                <circle
                  cx="30"
                  cy="30"
                  r={ringRadius}
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  cx="30"
                  cy="30"
                  r={ringRadius}
                  className={`${isTimerActive ? 'stroke-emerald-500' : 'stroke-indigo-500'} transition-all duration-700 ease-out`}
                  strokeWidth="5"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className={`absolute text-[10px] font-bold ${isTimerActive ? 'text-emerald-500' : 'text-indigo-500'}`}>
                {focusPercent}%
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('tasks')}
          className="cursor-pointer glass-card p-4 sm:p-5 rounded-2xl group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Task Completion</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#BF1A2F] bg-[#BF1A2F]/10 dark:bg-[#BF1A2F]/20 px-2 py-0.5 rounded-full border border-[#BF1A2F]/20">
              {totalTasks > 0 ? `${taskCompletionRate}%` : 'Ready'}
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {completedTasks}
              <span className="text-sm font-normal text-zinc-400"> / {totalTasks}</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-[#BF1A2F] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${totalTasks > 0 ? taskCompletionRate : 0}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              {totalTasks - completedTasks} active tasks pending
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('habits')}
          className="cursor-pointer glass-card p-4 sm:p-5 rounded-2xl group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Habit Streaks</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Flame size={16} />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
              {maxStreak} <span className="text-sm font-medium text-zinc-400">Days</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
            {completedHabitsToday} of {scheduledHabitsToday.length} completed today
          </p>
        </div>

        <div
          onClick={() => onNavigate('analytics')}
          className="cursor-pointer glass-card p-4 sm:p-5 rounded-2xl group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Weekly Score</span>
            <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              {weeklyScore >= 80 ? 'Optimal' : 'In Progress'}
            </span>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {weeklyScore}%
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Productivity rating
              </p>
            </div>
            <div className="w-14 h-10 flex items-center justify-center">
              <svg className="w-14 h-10" viewBox="0 0 60 40">
                <path
                  d="M 5 35 A 25 25 0 0 1 55 35"
                  fill="none"
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M 5 35 A 25 25 0 0 1 55 35"
                  fill="none"
                  className="stroke-cyan-500 transition-all duration-700"
                  strokeWidth="5"
                  strokeDasharray="78.5"
                  strokeDashoffset={78.5 - (weeklyScore / 100) * 78.5}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 glass-panel rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="text-indigo-600 dark:text-indigo-400 shrink-0" size={20} />
              <h2 className="font-semibold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate">
                Today's Integrated Schedule & Tasks
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {totalTasks > 0 && (
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition flex items-center gap-1"
                >
                  + Add Task
                </button>
              )}
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Calendar <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {todayEvents.length === 0 && todayTasks.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center py-4">
              <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-3">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workspace reset & ready</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
                  No tasks or events currently scheduled for today. Start fresh by creating your first task or launching a focus session!
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => onNavigate('tasks')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition"
                  >
                    + Create First Task
                  </button>
                  <button
                    onClick={() => onNavigate('focus')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition"
                  >
                    Start Focus Session
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              {todayEvents.map((event) => {
                const hasConflict = conflictIds.has(event.id);
                return (
                  <div
                    key={event.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition gap-2.5 ${hasConflict
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20'
                      : 'border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/40'
                      }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 mt-0.5 whitespace-nowrap shrink-0">
                        {event.startTime} - {event.endTime}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                            {event.title}
                          </span>
                          {hasConflict && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                              <AlertTriangle size={12} /> Schedule Conflict
                            </span>
                          )}
                        </div>
                        {event.notes && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{event.notes}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-medium whitespace-nowrap shrink-0 self-start sm:self-auto">
                      {event.category}
                    </span>
                  </div>
                );
              })}

              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-800/40 hover:border-indigo-500/50 transition group gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_TASK_STATUS', payload: task.id })}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition shrink-0 ${task.status === 'Done'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-500'
                        }`}
                    >
                      {task.status === 'Done' && <Check size={14} />}
                    </button>
                    <div className="min-w-0">
                      <span
                        className={`text-sm font-medium block truncate ${task.status === 'Done'
                          ? 'line-through text-zinc-400 dark:text-zinc-500'
                          : 'text-zinc-800 dark:text-zinc-200'
                          }`}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-xs text-zinc-400 line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => onLaunchFocusTask(task)}
                      title="Focus on this task"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                    >
                      <Timer size={16} />
                    </button>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium whitespace-nowrap shrink-0">
                      {task.category}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${task.priority === 'Urgent'
                        ? 'bg-red-500/15 text-red-500 border border-red-500/20'
                        : task.priority === 'High'
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                          : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'
                        }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">

          <div className="glass-panel rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Timer size={18} className="text-indigo-400" /> Focus Session
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {state.pomodoroWork || 25}:00
              </span>
            </div>

            <div className="my-6 flex flex-col items-center justify-center">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-pulse-slow" />
                <div className="w-28 h-28 rounded-full bg-indigo-950/40 border border-indigo-500/40 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20">
                  <span className="text-2xl font-mono font-bold text-white tracking-wider">
                    {state.pomodoroWork || 25}:00
                  </span>
                  <span className="text-[10px] text-indigo-300 font-medium mt-0.5">
                    Ready to Start
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('focus')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-md transition"
              >
                <Play size={15} className="fill-white" /> Launch Focus
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Weekly Output</h2>
              <span className="text-xs text-zinc-400">Past 7 Days</span>
            </div>

            <div className="h-28 w-full flex items-end justify-between gap-2 pt-2 px-1 border-b border-zinc-100 dark:border-zinc-800">
              {past7Days.map((day) => {
                const maxVal = Math.max(...past7Days.map((d) => d.mins), 60);
                const heightPercent = Math.max(10, Math.round((day.mins / maxVal) * 100));
                const isToday = day.str === todayStr;

                return (
                  <div key={day.str} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition">
                      {day.mins}m
                    </span>
                    <div className="w-full max-w-5 bg-zinc-100 dark:bg-zinc-800/80 rounded-t-md h-[4.5rem] flex items-end overflow-hidden p-0.5">
                      <div
                        className={`w-full rounded-t-sm transition-all duration-500 ${isToday
                          ? 'bg-indigo-600'
                          : 'bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-400'
                          }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium mt-1 ${isToday ? 'text-indigo-500 font-bold' : 'text-zinc-500'
                        }`}
                    >
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
              <span>Goal: {focusTarget * 7}m/wk</span>
              <button
                onClick={() => onNavigate('analytics')}
                className="text-indigo-400 hover:underline flex items-center gap-1"
              >
                Analytics <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};


const TaskManagerModule = ({ onLaunchFocusTask }) => {
  const { state, dispatch } = useLifeOS();
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState(getISODateStr());
  const [category, setCategory] = useState('Work');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);

  const todayStr = getISODateStr();

  const handleOpenAdd = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setDueDate(getISODateStr());
    setCategory('Work');
    setEstimatedMinutes(30);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setCategory(task.category);
    setEstimatedMinutes(task.estimatedMinutes || 30);
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          ...editingTask,
          title,
          description,
          priority,
          dueDate,
          category,
          estimatedMinutes: Number(estimatedMinutes)
        }
      });
    } else {
      const newTask = {
        id: `task-${Date.now()}`,
        title,
        description,
        priority,
        dueDate,
        category,
        estimatedMinutes: Number(estimatedMinutes),
        status: 'Todo'
      };
      dispatch({ type: 'ADD_TASK', payload: newTask });
    }
    setIsModalOpen(false);
  };

  const filteredTasks = state.tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  return (
    <div className="space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Task Manager</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Organize, prioritize, and focus on daily deliverables with synchronized status.
          </p>
        </div>

        <div className="flex items-center gap-2">

          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-sm flex items-center gap-1.5 font-medium transition ${viewMode === 'list'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
                : 'text-zinc-500 dark:text-zinc-400'
                }`}
            >
              <List size={16} /> List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-sm flex items-center gap-1.5 font-medium transition ${viewMode === 'kanban'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
                : 'text-zinc-500 dark:text-zinc-400'
                }`}
            >
              <Columns size={16} /> Kanban
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow transition"
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          <option value="Work">Work</option>
          <option value="Personal">Personal</option>
          <option value="Health">Health</option>
          <option value="Finance">Finance</option>
          <option value="Learning">Learning</option>
        </select>
      </div>

      {viewMode === 'list' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              No tasks found matching your filter criteria.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isOverdue = task.dueDate < todayStr && task.status !== 'Done';
              return (
                <div
                  key={task.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition group"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_TASK_STATUS', payload: task.id })}
                      className={`w-5 h-5 mt-0.5 rounded flex items-center justify-center border transition ${task.status === 'Done'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-500'
                        }`}
                    >
                      {task.status === 'Done' && <Check size={14} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-sm ${task.status === 'Done'
                            ? 'line-through text-zinc-400 dark:text-zinc-500'
                            : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                        >
                          {task.title}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full">
                            <AlertCircle size={12} /> Overdue
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <CalendarIcon size={12} className="shrink-0" /> {task.dueDate}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Tag size={12} className="shrink-0" /> {task.category}
                        </span>
                        <span className="whitespace-nowrap">{task.estimatedMinutes}m est.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ${task.priority === 'Urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        : task.priority === 'High'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : task.priority === 'Medium'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                    >
                      {task.priority}
                    </span>

                    <button
                      onClick={() => onLaunchFocusTask(task)}
                      title="Launch Focus Session for this task"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition shrink-0"
                    >
                      <Timer size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(task)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
                      title="Edit Task"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_TASK', payload: task.id })}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition shrink-0"
                      title="Delete Task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Todo', 'In Progress', 'Done'].map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col min-h-[350px] max-h-[550px] md:h-[650px]"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 font-bold text-zinc-500">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {columnTasks.map((task) => {
                    const isOverdue = task.dueDate < todayStr && task.status !== 'Done';
                    return (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/60 p-4 rounded-xl shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`font-semibold text-sm ${task.status === 'Done' ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
                              }`}
                          >
                            {task.title}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${task.priority === 'Urgent'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                              }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                          <span className={isOverdue ? 'text-red-500 font-semibold' : ''}>
                            {task.dueDate}
                          </span>
                          <div className="flex items-center gap-1">

                            {status !== 'Todo' && (
                              <button
                                onClick={() =>
                                  dispatch({
                                    type: 'UPDATE_TASK',
                                    payload: { ...task, status: status === 'Done' ? 'In Progress' : 'Todo' }
                                  })
                                }
                                className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-300 transition"
                              >
                                ← Prev
                              </button>
                            )}
                            {status !== 'Done' && (
                              <button
                                onClick={() =>
                                  dispatch({
                                    type: 'UPDATE_TASK',
                                    payload: { ...task, status: status === 'Todo' ? 'In Progress' : 'Done' }
                                  })
                                }
                                className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-medium transition"
                              >
                                Next →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prepare Architecture Deck"
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key deliverable notes..."
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Health">Health</option>
                <option value="Finance">Finance</option>
                <option value="Learning">Learning</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Est. Duration (mins)
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const HabitTrackerModule = () => {
  const { state, dispatch } = useLifeOS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const [title, setTitle] = useState('');
  const [scheduleType, setScheduleType] = useState('daily');
  const [customDays, setCustomDays] = useState([1, 2, 3, 4, 5]);
  const [color, setColor] = useState('#6366f1');

  const todayStr = getISODateStr();
  const [startDate, setStartDate] = useState(todayStr);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleOpenAdd = () => {
    setEditingHabit(null);
    setTitle('');
    setScheduleType('daily');
    setCustomDays([0, 1, 2, 3, 4, 5, 6]);
    setColor('#6366f1');
    setStartDate(todayStr);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (h) => {
    setEditingHabit(h);
    setTitle(h.title);
    setScheduleType(h.scheduleType || 'daily');
    setCustomDays(h.scheduleDays || [0, 1, 2, 3, 4, 5, 6]);
    setColor(h.color || '#6366f1');
    const effectiveStart =
      h.startDate ||
      (h.createdAt ? getISODateStr(new Date(h.createdAt)) : null) ||
      (h.completions && h.completions.length > 0 ? [...h.completions].sort()[0] : todayStr);
    setStartDate(effectiveStart);
    setIsModalOpen(true);
  };

  const toggleCustomDay = (dayIndex) => {
    if (customDays.includes(dayIndex)) {
      if (customDays.length > 1) {
        setCustomDays(customDays.filter((d) => d !== dayIndex));
      }
    } else {
      setCustomDays([...customDays, dayIndex].sort());
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const scheduleDays =
      scheduleType === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : scheduleType === 'weekdays'
          ? [1, 2, 3, 4, 5]
          : customDays;

    const habitStartDate = startDate || todayStr;

    if (editingHabit) {
      dispatch({
        type: 'UPDATE_HABIT',
        payload: {
          ...editingHabit,
          title,
          scheduleType,
          scheduleDays,
          color,
          startDate: habitStartDate
        }
      });
    } else {
      const newHabit = {
        id: `habit-${Date.now()}`,
        title,
        scheduleType,
        scheduleDays,
        color,
        startDate: habitStartDate,
        createdAt: new Date().toISOString(),
        bestStreak: 0,
        completions: []
      };
      dispatch({ type: 'ADD_HABIT', payload: newHabit });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Habit Tracker</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Build disciplined routines. Streaks intelligently adjust for scheduled rest days.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow transition self-start sm:self-auto"
        >
          <Plus size={16} /> New Habit
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {state.habits.map((habit) => {
          const { currentStreak, longestStreak } = computeHabitStreaks(habit);
          const isDoneToday = habit.completions.includes(todayStr);

          // Get track days starting from the habit's start date (up to today, max 30 days)
          const trackDays = getHabitTrackDays(habit);
          const activeDaysInTrack = trackDays.filter((d) =>
            habit.scheduleDays.includes(d.dayOfWeek)
          );
          const completedInTrack = activeDaysInTrack.filter((d) =>
            habit.completions.includes(d.dateStr)
          ).length;
          const completionRate =
            activeDaysInTrack.length > 0
              ? Math.round((completedInTrack / activeDaysInTrack.length) * 100)
              : 0;

          return (
            <div
              key={habit.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color || '#6366f1' }}
                  />
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                      {habit.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Schedule:{' '}
                      {habit.scheduleDays.length === 7
                        ? 'Everyday'
                        : habit.scheduleDays.map((d) => dayNames[d]).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-semibold whitespace-nowrap shrink-0">
                    <Flame size={15} className="text-amber-500 fill-amber-500 shrink-0" />
                    <span className="whitespace-nowrap">{currentStreak} day streak</span>
                    <span className="text-zinc-400 font-normal whitespace-nowrap">| best {longestStreak}</span>
                  </div>

                  <button
                    onClick={() => {
                      dispatch({
                        type: 'TOGGLE_HABIT_DATE',
                        payload: { habitId: habit.id, dateStr: todayStr }
                      });
                      if (!isDoneToday) playChime();
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${isDoneToday
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                  >
                    <Check size={14} />
                    {isDoneToday ? 'Done Today' : 'Mark Today'}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(habit)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                    title="Edit Habit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_HABIT', payload: habit.id })}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
                    title="Delete Habit"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  <span className="font-medium whitespace-nowrap">
                    {trackDays.length === 1
                      ? 'Day 1 Activity'
                      : `${trackDays.length}-Day Activity Heatmap`}
                  </span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] sm:text-xs whitespace-nowrap">
                    {completionRate}% adherence ({completedInTrack}/{activeDaysInTrack.length} scheduled)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {trackDays.map((d) => {
                    const isScheduled = habit.scheduleDays.includes(d.dayOfWeek);
                    const isCompleted = habit.completions.includes(d.dateStr);

                    let bgClass = 'bg-zinc-100 dark:bg-zinc-800';
                    if (!isScheduled) {
                      bgClass = 'bg-zinc-100/40 dark:bg-zinc-800/20 border border-dashed border-zinc-200 dark:border-zinc-800';
                    } else if (isCompleted) {
                      bgClass = 'bg-emerald-500 text-white';
                    }

                    return (
                      <button
                        key={d.dateStr}
                        onClick={() =>
                          dispatch({
                            type: 'TOGGLE_HABIT_DATE',
                            payload: { habitId: habit.id, dateStr: d.dateStr }
                          })
                        }
                        title={`${d.dateStr} (${isScheduled ? 'Scheduled' : 'Rest day'}) - ${isCompleted ? 'Completed' : 'Missed'
                          }`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] font-medium flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${bgClass}`}
                      >
                        {d.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHabit ? 'Edit Habit' : 'New Habit'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Habit Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Read 30 pages"
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Start Tracking From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Schedule Frequency
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <option value="daily">Everyday (7 days / week)</option>
              <option value="weekdays">Weekdays Only (Mon - Fri)</option>
              <option value="custom">Custom Days</option>
            </select>
          </div>

          {scheduleType === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Select Active Days
              </label>
              <div className="flex gap-1.5">
                {dayNames.map((name, idx) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => toggleCustomDay(idx)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${customDays.includes(idx)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Badge Accent Color
            </label>
            <div className="flex items-center gap-3">
              {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                    }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
            >
              Save Habit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const CalendarModule = () => {
  const { state, dispatch } = useLifeOS();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(getISODateStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Work');
  const [notes, setNotes] = useState('');

  const conflictIds = useMemo(() => checkEventConflicts(state.events), [state.events]);

  const weekDates = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const handlePrev = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (viewType === 'week' ? 7 : 1));
    setSelectedDate(d);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (viewType === 'week' ? 7 : 1));
    setSelectedDate(d);
  };

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setTitle('');
    setEventDate(getISODateStr(selectedDate));
    setStartTime('10:00');
    setEndTime('11:00');
    setCategory('Work');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (endTime <= startTime) {
      alert('End time must be after start time.');
      return;
    }

    if (editingEvent) {
      dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          ...editingEvent,
          title,
          date: eventDate,
          startTime,
          endTime,
          category,
          notes
        }
      });
    } else {
      const newEvent = {
        id: `event-${Date.now()}`,
        title,
        date: eventDate,
        startTime,
        endTime,
        category,
        notes
      };
      dispatch({ type: 'ADD_EVENT', payload: newEvent });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Calendar & Planner</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Unified schedule merging calendar commitments and task deadlines with conflict warnings.
          </p>
        </div>

        <div className="flex items-center gap-2">

          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewType('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewType === 'day'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
                : 'text-zinc-500'
                }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewType === 'week'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
                : 'text-zinc-500'
                }`}
            >
              Week
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow transition"
          >
            <Plus size={16} /> New Event
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 whitespace-nowrap"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="text-xs text-zinc-400 sm:hidden">
            {conflictIds.size > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold whitespace-nowrap text-[11px]">
                <AlertTriangle size={13} /> {conflictIds.size} Conflicts
              </span>
            )}
          </div>
        </div>

        <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 text-center sm:text-left whitespace-nowrap">
          {viewType === 'week' ? (
            <>
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
              {weekDates[6].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </>
          ) : (
            selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })
          )}
        </h3>

        <div className="text-xs text-zinc-400 hidden sm:block">
          {conflictIds.size > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-semibold whitespace-nowrap">
              <AlertTriangle size={14} /> {conflictIds.size} Conflicts Active
            </span>
          )}
        </div>
      </div>

      {viewType === 'week' ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDates.map((dateObj) => {
            const dateStr = getISODateStr(dateObj);
            const isToday = dateStr === getISODateStr();
            const dayEvents = state.events.filter((e) => e.date === dateStr);
            const dayTasks = state.tasks.filter((t) => t.dueDate === dateStr);

            return (
              <div
                key={dateStr}
                className={`min-h-[140px] md:min-h-[380px] bg-white dark:bg-zinc-900 border rounded-2xl p-3 flex flex-col gap-2 transition ${isToday
                  ? 'border-indigo-500 dark:border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
                  : 'border-zinc-200 dark:border-zinc-800'
                  }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'
                      }`}
                  >
                    {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isToday ? 'bg-indigo-600 text-white' : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                  >
                    {dateObj.getDate()}
                  </span>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">

                  {dayEvents.map((ev) => {
                    const isConflicted = conflictIds.has(ev.id);
                    return (
                      <div
                        key={ev.id}
                        className={`p-2 rounded-xl text-xs border relative group transition ${isConflicted
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900 text-red-900 dark:text-red-200'
                          : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200'
                          }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            {ev.startTime} - {ev.endTime}
                          </span>
                          <button
                            onClick={() => dispatch({ type: 'DELETE_EVENT', payload: ev.id })}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="font-medium mt-0.5">{ev.title}</div>
                        {isConflicted && (
                          <div className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-0.5 mt-1">
                            <AlertTriangle size={10} /> Conflict
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-1.5 rounded-lg text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700"
                    >
                      <CheckSquare size={12} className="text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
            Agenda for {getISODateStr(selectedDate)}
          </h2>

          <div className="space-y-3">
            {state.events.filter((e) => e.date === getISODateStr(selectedDate)).length === 0 && (
              <p className="text-zinc-400 text-sm py-8 text-center">No events booked for this day.</p>
            )}

            {state.events
              .filter((e) => e.date === getISODateStr(selectedDate))
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((ev) => {
                const isConflicted = conflictIds.has(ev.id);
                return (
                  <div
                    key={ev.id}
                    className={`flex items-start justify-between p-4 rounded-xl border ${isConflicted
                      ? 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {ev.startTime} - {ev.endTime}
                        </span>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{ev.title}</h4>
                        {isConflicted && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={14} /> Schedule Conflict
                          </span>
                        )}
                      </div>
                      {ev.notes && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{ev.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_EVENT', payload: ev.id })}
                      className="text-zinc-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Event">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Architecture Sync"
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Health">Health</option>
              <option value="Finance">Finance</option>
              <option value="Learning">Learning</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Meeting link, location, agenda..."
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
            >
              Save Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const FocusTimerModule = ({
  activeTask,
  onClearActiveTask,
  onRunningChange,
  onTimerTick,
  triggerAutoStart,
  onAutoStartHandled
}) => {
  const { state, dispatch } = useLifeOS();

  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.mode) return p.mode;
      }
    } catch {}
    return 'focus';
  });

  const [customMins, setCustomMins] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.customMins === 'number') return p.customMins;
      }
    } catch {}
    return 30;
  });

  const [isRunning, setIsRunning] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.isRunning && p.targetEndTime && p.targetEndTime > Date.now()) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  const [targetEndTime, setTargetEndTime] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.isRunning && p.targetEndTime && p.targetEndTime > Date.now()) {
          return p.targetEndTime;
        }
      }
    } catch {}
    return null;
  });

  const [pausedRemainingSeconds, setPausedRemainingSeconds] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.isRunning && p.targetEndTime) {
          if (p.targetEndTime > Date.now()) {
            return Math.max(0, Math.round((p.targetEndTime - Date.now()) / 1000));
          }
          return 25 * 60;
        }
        if (typeof p.pausedRemainingSeconds === 'number' && p.pausedRemainingSeconds > 0) {
          return p.pausedRemainingSeconds;
        }
      }
    } catch {}
    return 25 * 60;
  });

  const [totalSessionSeconds, setTotalSessionSeconds] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.totalSessionSeconds === 'number') return p.totalSessionSeconds;
      }
    } catch {}
    return 25 * 60;
  });

  useEffect(() => {
    if (onRunningChange) {
      onRunningChange(isRunning);
    }
  }, [isRunning, onRunningChange]);

  useEffect(() => {
    if (onTimerTick) {
      onTimerTick({
        isRunning,
        mode,
        remainingSeconds: pausedRemainingSeconds,
        totalSeconds: totalSessionSeconds,
        elapsedSeconds: Math.max(0, totalSessionSeconds - pausedRemainingSeconds)
      });
    }
  }, [isRunning, mode, pausedRemainingSeconds, totalSessionSeconds, onTimerTick]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'lifeos_active_focus_timer_v2',
        JSON.stringify({
          mode,
          customMins,
          isRunning,
          targetEndTime,
          pausedRemainingSeconds,
          totalSessionSeconds
        })
      );
    } catch {}
  }, [mode, customMins, isRunning, targetEndTime, pausedRemainingSeconds, totalSessionSeconds]);

  const selectedTaskId = activeTask?.id || null;

  const getDurationForMode = (m, customVal = customMins) => {
    if (m === 'focus') return (state.pomodoroWork || 25) * 60;
    if (m === 'break') return (state.pomodoroBreak || 5) * 60;
    return customVal * 60;
  };

  const handleStart = () => {
    const end = Date.now() + pausedRemainingSeconds * 1000;
    setTargetEndTime(end);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    if (targetEndTime) {
      const remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
      setPausedRemainingSeconds(remaining);
      setTargetEndTime(null);
    }
  };

  const recordElapsedIfAny = () => {
    const elapsedSecs = totalSessionSeconds - pausedRemainingSeconds;
    const elapsedMins = Math.floor(elapsedSecs / 60);
    if ((mode === 'focus' || mode === 'custom') && elapsedMins >= 1) {
      dispatch({
        type: 'RECORD_FOCUS_SESSION',
        payload: {
          id: `fs-${Date.now()}`,
          taskId: selectedTaskId,
          taskTitle: activeTask ? activeTask.title : 'Deep Focus Session',
          durationMinutes: elapsedMins,
          date: getISODateStr(),
          completedAt: new Date().toISOString()
        }
      });
    }
  };

  const handleReset = () => {
    recordElapsedIfAny();
    setIsRunning(false);
    setTargetEndTime(null);
    const secs = getDurationForMode(mode);
    setPausedRemainingSeconds(secs);
    setTotalSessionSeconds(secs);
    try {
      localStorage.removeItem('lifeos_active_focus_timer_v2');
    } catch {}
  };

  const handleModeSwitch = (newMode) => {
    recordElapsedIfAny();
    setIsRunning(false);
    setTargetEndTime(null);
    const secs = getDurationForMode(newMode);
    setMode(newMode);
    setPausedRemainingSeconds(secs);
    setTotalSessionSeconds(secs);
  };

  const handleCustomMinutesChange = (newMins) => {
    const mins = Math.max(1, Math.min(240, Number(newMins) || 1));
    setCustomMins(mins);
    if (!isRunning && mode === 'custom') {
      const secs = mins * 60;
      setPausedRemainingSeconds(secs);
      setTotalSessionSeconds(secs);
      setTargetEndTime(null);
    }
  };

  useEffect(() => {
    if (triggerAutoStart) {
      if (!isRunning) {
        handleStart();
      }
      if (onAutoStartHandled) {
        onAutoStartHandled();
      }
    }
  }, [triggerAutoStart, isRunning]);

  useEffect(() => {
    if (!isRunning || !targetEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
      setPausedRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsRunning(false);
        setTargetEndTime(null);
        try {
          localStorage.removeItem('lifeos_active_focus_timer_v2');
        } catch {}
        playChime();

        if (mode === 'focus' || mode === 'custom') {
          const completedMins = Math.round(totalSessionSeconds / 60);
          dispatch({
            type: 'RECORD_FOCUS_SESSION',
            payload: {
              id: `fs-${Date.now()}`,
              taskId: selectedTaskId,
              taskTitle: activeTask ? activeTask.title : 'Deep Focus Session',
              durationMinutes: completedMins,
              date: getISODateStr(),
              completedAt: new Date().toISOString()
            }
          });
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, targetEndTime, mode, totalSessionSeconds, selectedTaskId, activeTask, dispatch]);

  const minutes = Math.floor(pausedRemainingSeconds / 60);
  const seconds = pausedRemainingSeconds % 60;
  const progressPercent =
    totalSessionSeconds > 0
      ? Math.round(((totalSessionSeconds - pausedRemainingSeconds) / totalSessionSeconds) * 100)
      : 0;

  const todayStr = getISODateStr();
  const todayFocusTotal = state.focusSessions
    .filter((s) => s.date === todayStr)
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const focusTarget = state.focusGoalMinutes || 120;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Deep Focus Timer</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Timestamp-synchronized interval timer. Tab changes will not disrupt session accuracy.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-8 shadow-sm flex flex-col items-center text-center">

        {activeTask && (
          <div className="mb-6 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm max-w-full">
            <CheckSquare size={16} className="shrink-0" />
            <span className="truncate">
              Target Task: <strong>{activeTask.title}</strong>
            </span>
            <button
              onClick={onClearActiveTask}
              className="ml-2 text-xs font-semibold hover:underline shrink-0"
            >
              Detach
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 sm:flex bg-zinc-100 dark:bg-zinc-800 p-1 sm:p-1.5 rounded-2xl mb-4 w-full max-w-md">
          <button
            onClick={() => handleModeSwitch('focus')}
            className={`px-2 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition text-center ${mode === 'focus'
              ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
          >
            Focus ({state.pomodoroWork || 25}m)
          </button>
          <button
            onClick={() => handleModeSwitch('break')}
            className={`px-2 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition text-center ${mode === 'break'
              ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
          >
            Break ({state.pomodoroBreak || 5}m)
          </button>
          <button
            onClick={() => handleModeSwitch('custom')}
            className={`px-2 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition text-center ${mode === 'custom'
              ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
          >
            Custom ({customMins}m)
          </button>
        </div>

        {mode === 'custom' && (
          <div className="mb-6 p-5 rounded-2xl bg-[#3e3f3f] border border-[#505151] shadow-lg w-full max-w-md transition-all text-white">
            <div className="flex items-center justify-between mb-3.5 text-xs font-semibold text-purple-200">
              <span className="tracking-wide">Choose Your Timer Duration:</span>
              <span className="font-mono text-sm bg-purple-500/30 border border-purple-400/40 px-2.5 py-0.5 rounded-lg text-purple-200 font-bold">
                {customMins} minutes
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3.5">
              {[10, 15, 20, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  disabled={isRunning}
                  onClick={() => handleCustomMinutesChange(mins)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${customMins === mins
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400/50'
                    : 'bg-[#2b2c2c] hover:bg-[#343535] text-zinc-100 border border-[#505151]'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isRunning || customMins <= 5}
                onClick={() => handleCustomMinutesChange(Math.max(1, customMins - 5))}
                className="w-9 h-9 rounded-xl bg-[#2b2c2c] hover:bg-[#343535] border border-[#505151] flex items-center justify-center text-xs font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                title="Decrease 5 minutes"
              >
                -5
              </button>

              <input
                type="range"
                min="1"
                max="180"
                step="1"
                value={customMins}
                disabled={isRunning}
                onChange={(e) => handleCustomMinutesChange(parseInt(e.target.value, 10) || 1)}
                className="flex-1 accent-purple-400 cursor-pointer"
              />

              <button
                type="button"
                disabled={isRunning || customMins >= 180}
                onClick={() => handleCustomMinutesChange(Math.min(180, customMins + 5))}
                className="w-9 h-9 rounded-xl bg-[#2b2c2c] hover:bg-[#343535] border border-[#505151] flex items-center justify-center text-xs font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                title="Increase 5 minutes"
              >
                +5
              </button>
            </div>
            {isRunning && (
              <p className="text-xs text-zinc-300 mt-2.5 text-center font-medium">
                Session active. Pause or reset to change duration.
              </p>
            )}
          </div>
        )}

        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-zinc-100 dark:stroke-zinc-800"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-indigo-600 dark:text-indigo-500 transition-all duration-300"
              strokeWidth="7"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-5xl sm:text-6xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </span>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mt-2">
              {isRunning ? 'Session Active' : 'Paused / Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleReset}
            className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="Reset Session"
          >
            <RotateCcw size={20} />
          </button>

          {isRunning ? (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm sm:text-base shadow-lg transition whitespace-nowrap"
            >
              <Pause size={18} /> Pause Focus
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg transition whitespace-nowrap"
            >
              <Play size={18} /> Start Session
            </button>
          )}
        </div>

        <div className="w-full max-w-md mt-8 sm:mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="whitespace-nowrap">Today's Accumulated Target</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
              {todayFocusTotal} / {focusTarget} mins ({Math.min(100, Math.round((todayFocusTotal / focusTarget) * 100))}%)
            </span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((todayFocusTotal / focusTarget) * 100))}%`
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mb-4">
          Completed Focus Sessions
        </h3>
        <div className="space-y-2.5">
          {state.focusSessions.slice(0, 5).map((fs) => (
            <div
              key={fs.id}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-sm"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {fs.taskTitle || 'Ad-hoc Focus Session'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                  {fs.durationMinutes} minutes
                </span>
                <span>{fs.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GoalsModule = () => {
  const { state, dispatch } = useLifeOS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Learning');
  const [targetDate, setTargetDate] = useState(getRelativeDateStr(30));
  const [milestonesList, setMilestonesList] = useState([
    { id: 'm-1', title: '', completed: false }
  ]);

  const resetForm = () => {
    setTitle('');
    setCategory('Learning');
    setTargetDate(getRelativeDateStr(30));
    setMilestonesList([{ id: 'm-1', title: '', completed: false }]);
    setEditingGoal(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setCategory(goal.category);
    setTargetDate(goal.targetDate);
    setMilestonesList(
      goal.milestones.map((m) => ({ ...m }))
    );
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const handleAddMilestoneInput = () => {
    setMilestonesList([
      ...milestonesList,
      { id: `m-${Date.now()}-${Math.random()}`, title: '', completed: false }
    ]);
  };

  const handleMilestoneTextChange = (id, text) => {
    setMilestonesList(
      milestonesList.map((m) => (m.id === id ? { ...m, title: text } : m))
    );
  };

  const handleRemoveMilestoneInput = (id) => {
    if (milestonesList.length > 1) {
      setMilestonesList(milestonesList.filter((m) => m.id !== id));
    }
  };

  const handleSaveGoal = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validMilestones = milestonesList.filter((m) => m.title.trim().length > 0);
    const finalMilestones =
      validMilestones.length > 0
        ? validMilestones
        : [{ id: `m-${Date.now()}`, title: 'Complete core objective', completed: false }];

    if (editingGoal) {
      // Preserve completion state for milestones that already existed
      const existingMap = {};
      editingGoal.milestones.forEach((m) => { existingMap[m.id] = m.completed; });
      const mergedMilestones = finalMilestones.map((m) => ({
        ...m,
        completed: existingMap[m.id] !== undefined ? existingMap[m.id] : m.completed
      }));

      dispatch({
        type: 'UPDATE_GOAL',
        payload: {
          id: editingGoal.id,
          title,
          category,
          targetDate,
          milestones: mergedMilestones
        }
      });
    } else {
      const newGoal = {
        id: `goal-${Date.now()}`,
        title,
        category,
        targetDate,
        milestones: finalMilestones
      };
      dispatch({ type: 'ADD_GOAL', payload: newGoal });
    }

    handleCloseModal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Goals & Milestones</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            High-level ambitions broken down into measurable checkpoints with purely calculated progress.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow transition self-start sm:self-auto"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.goals.map((goal) => {
          const totalMilestones = goal.milestones.length;
          const completedCount = goal.milestones.filter((m) => m.completed).length;
          const progressPercent =
            totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0;
          const isOverdue = goal.targetDate < getISODateStr() && progressPercent < 100;

          return (
            <div
              key={goal.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                      {goal.category}
                    </span>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mt-2">
                      {goal.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="text-zinc-400 hover:text-indigo-600 p-1 transition"
                      title="Edit goal"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_GOAL', payload: goal.id })}
                      className="text-zinc-400 hover:text-red-600 p-1 transition"
                      title="Delete goal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-2 flex-wrap">
                  <CalendarIcon size={13} className="shrink-0" />
                  <span className="whitespace-nowrap">Target Date: {goal.targetDate}</span>
                  {isOverdue && (
                    <span className="font-bold text-red-500 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      Overdue
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-zinc-600 dark:text-zinc-400">Goal Progress</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Milestones ({completedCount}/{totalMilestones})
                  </span>
                  <div className="space-y-1.5">
                    {goal.milestones.map((m) => (
                      <div
                        key={m.id}
                        onClick={() =>
                          dispatch({
                            type: 'TOGGLE_MILESTONE',
                            payload: { goalId: goal.id, milestoneId: m.id }
                          })
                        }
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition text-xs select-none"
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${m.completed
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-600'
                            }`}
                        >
                          {m.completed && <Check size={12} />}
                        </div>
                        <span
                          className={`${m.completed
                            ? 'line-through text-zinc-400 dark:text-zinc-500'
                            : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                        >
                          {m.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingGoal ? 'Edit Goal' : 'Create New Goal'}>
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
              Goal Objective *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Read 12 non-fiction books"
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <option value="Learning">Learning</option>
                <option value="Work">Work</option>
                <option value="Health">Health</option>
                <option value="Finance">Finance</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Target Date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Measurable Milestones
              </label>
              <button
                type="button"
                onClick={handleAddMilestoneInput}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                + Add Checkpoint
              </button>
            </div>
            <div className="space-y-2">
              {milestonesList.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Milestone #${idx + 1}`}
                    value={m.title}
                    onChange={(e) => handleMilestoneTextChange(m.id, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                  />
                  {milestonesList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestoneInput(m.id)}
                      className="text-zinc-400 hover:text-red-500 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
            >
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const AnalyticsModule = () => {
  const { state } = useLifeOS();
  const [rangeDays, setRangeDays] = useState(7);

  const chartDays = useMemo(() => {
    const list = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = getISODateStr(d);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

      const focusMinutes = state.focusSessions
        .filter((fs) => fs.date === str)
        .reduce((sum, item) => sum + item.durationMinutes, 0);

      const tasksCompleted = state.tasks.filter((t) => t.dueDate === str && t.status === 'Done').length;

      list.push({ str, label, focusMinutes, tasksCompleted });
    }
    return list;
  }, [rangeDays, state.focusSessions, state.tasks]);

  const categoryStats = useMemo(() => {
    const map = {};
    state.tasks.forEach((t) => {
      if (!map[t.category]) map[t.category] = { total: 0, done: 0 };
      map[t.category].total += 1;
      if (t.status === 'Done') map[t.category].done += 1;
    });
    return Object.entries(map).map(([name, data]) => ({
      name,
      ...data,
      pct: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
    }));
  }, [state.tasks]);

  const maxFocus = Math.max(...chartDays.map((d) => d.focusMinutes), 60);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Productivity Analytics</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Real metrics calculated strictly from logged tasks, habits, and focus minutes.
          </p>
        </div>

        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setRangeDays(7)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${rangeDays === 7
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
              : 'text-zinc-500'
              }`}
          >
            Past 7 Days
          </button>
          <button
            onClick={() => setRangeDays(14)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${rangeDays === 14
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow'
              : 'text-zinc-500'
              }`}
          >
            Past 14 Days
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
            Daily Focus Duration (Minutes)
          </h3>
          <span className="text-xs text-zinc-400">Peak: {maxFocus}m</span>
        </div>

        <div className="h-60 w-full flex items-end justify-between gap-2 pt-6 px-2 border-b border-zinc-100 dark:border-zinc-800">
          {chartDays.map((d) => {
            const heightPercent = Math.max(6, Math.round((d.focusMinutes / maxFocus) * 100));
            return (
              <div key={d.str} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition">
                  {d.focusMinutes}m
                </span>
                <div className="w-full max-w-9 bg-zinc-100 dark:bg-zinc-800 rounded-t-lg h-44 flex items-end p-0.5">
                  <div
                    className="w-full bg-indigo-600 rounded-t-md transition-all duration-500 group-hover:brightness-110"
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 truncate max-w-[42px] mt-1">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mb-4">
            Task Deliverables by Category
          </h3>
          <div className="space-y-4">
            {categoryStats.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                  <span className="text-zinc-500">
                    {cat.done} / {cat.total} completed ({cat.pct}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mb-4">
            Habit Consistency Summary
          </h3>
          <div className="space-y-3">
            {state.habits.map((h) => {
              const { currentStreak, longestStreak } = computeHabitStreaks(h);
              return (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {h.title}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {currentStreak}d current / {longestStreak}d record
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsModule = () => {
  const { state, dispatch } = useLifeOS();
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [focusGoal, setFocusGoal] = useState(state.focusGoalMinutes || 120);
  const [pomoWork, setPomoWork] = useState(state.pomodoroWork || 25);
  const [pomoBreak, setPomoBreak] = useState(state.pomodoroBreak || 5);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        focusGoalMinutes: Number(focusGoal),
        pomodoroWork: Number(pomoWork),
        pomodoroBreak: Number(pomoBreak)
      }
    });
    alert('Settings preferences updated.');
  };

  const handleExportJSON = () => {
    const backup = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      theme: state.theme,
      focusGoalMinutes: state.focusGoalMinutes,
      pomodoroWork: state.pomodoroWork,
      pomodoroBreak: state.pomodoroBreak,
      tasks: state.tasks,
      habits: state.habits,
      events: state.events,
      goals: state.goals,
      focusSessions: state.focusSessions
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifeos-backup-${getISODateStr()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    setImportError(null);
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Root JSON must be a valid object structure.');
        }
        if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.habits)) {
          throw new Error('Invalid LifeOS schema: missing required tasks or habits arrays.');
        }

        dispatch({ type: 'LOAD_BACKUP', payload: parsed });
        setImportSuccess(true);
      } catch (err) {
        setImportError(err.message || 'Malformed JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Personalization & Data</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure preferences, inspect backups, or export your unified state.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mb-4">
          Focus Timer Preferences
        </h3>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Daily Focus Target (mins)
              </label>
              <input
                type="number"
                min="10"
                max="600"
                value={focusGoal}
                onChange={(e) => setFocusGoal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Pomodoro Focus (mins)
              </label>
              <input
                type="number"
                min="5"
                max="90"
                value={pomoWork}
                onChange={(e) => setPomoWork(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Short Break (mins)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={pomoBreak}
                onChange={(e) => setPomoBreak(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow"
          >
            Save Preferences
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
          Data Management & JSON Portability
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Export your entire workspace or import previous JSON backups safely without corrupting memory.
        </p>

        {importError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-600 text-xs font-semibold">
            {importError}
          </div>
        )}
        {importSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-600 text-xs font-semibold">
            Data restored successfully from JSON backup!
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold transition"
          >
            <Download size={16} /> Export Backup (.json)
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold transition"
          >
            <Upload size={16} /> Import Backup
          </button>

          <button
            onClick={() => {
              if (window.confirm('Reset all tasks, habits, and sessions to initial sample data?')) {
                dispatch({ type: 'RESET_DEFAULTS' });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm font-semibold transition ml-auto"
          >
            <RefreshCw size={16} /> Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

const CommandPalette = ({ isOpen, onClose, onNavigate, onLaunchFocusTask }) => {
  const { state } = useLifeOS();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchingTasks = state.tasks
    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4);

  const navItems = [
    { label: 'Dashboard', module: 'dashboard' },
    { label: 'Task Manager', module: 'tasks' },
    { label: 'Habit Tracker', module: 'habits' },
    { label: 'Calendar & Schedule', module: 'calendar' },
    { label: 'Focus Timer', module: 'focus' },
    { label: 'Goals & Milestones', module: 'goals' },
    { label: 'Productivity Analytics', module: 'analytics' },
    { label: 'Settings & Data', module: 'settings' }
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">

        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <Search size={18} className="text-zinc-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search tasks, or jump to module..."
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
            ESC
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-3">

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">
              Navigation
            </span>
            <div className="mt-1 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.module}
                  onClick={() => {
                    onNavigate(item.module);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <span>Go to {item.label}</span>
                  <ArrowRight size={12} className="text-zinc-400" />
                </button>
              ))}
            </div>
          </div>

          {matchingTasks.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">
                Tasks
              </span>
              <div className="mt-1 space-y-1">
                {matchingTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onLaunchFocusTask(t);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CheckSquare size={13} className="text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] text-indigo-500 font-bold">Focus Now</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function LifeOSApp() {
  const { state, dispatch } = useLifeOS();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeFocusTask, setActiveFocusTask] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [focusTimerState, setFocusTimerState] = useState(() => {
    try {
      const saved = localStorage.getItem('lifeos_active_focus_timer_v2');
      if (saved) {
        const p = JSON.parse(saved);
        const isRunning = Boolean(p.isRunning && p.targetEndTime && p.targetEndTime > Date.now());
        const remaining = isRunning ? Math.max(0, Math.round((p.targetEndTime - Date.now()) / 1000)) : (p.pausedRemainingSeconds || 25 * 60);
        const total = p.totalSessionSeconds || 25 * 60;
        return {
          isRunning,
          mode: p.mode || 'focus',
          remainingSeconds: remaining,
          totalSeconds: total,
          elapsedSeconds: Math.max(0, total - remaining)
        };
      }
    } catch {}
    return {
      isRunning: false,
      mode: 'focus',
      remainingSeconds: 25 * 60,
      totalSeconds: 25 * 60,
      elapsedSeconds: 0
    };
  });
  const [triggerAutoStartTimer, setTriggerAutoStartTimer] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleStartFocus = () => {
    setActiveModule('focus');
    setTriggerAutoStartTimer(true);
  };

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleLaunchFocusTask = (task) => {
    setActiveFocusTask(task);
    setActiveModule('focus');
    setTriggerAutoStartTimer(true);
  };

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'habits', label: 'Habits', icon: Flame },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'focus', label: 'Focus Timer', icon: Timer },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const activeNavLabel = navLinks.find((l) => l.id === activeModule)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row font-sans transition-colors duration-200">

      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="LifeOS Logo"
            className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-zinc-900 dark:text-white leading-none">
                LifeOS
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                {activeNavLabel}
              </span>
            </div>
            <span className="text-[9px] block font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase mt-0.5">
              Personal Suite
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!state.history || state.history.length === 0}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 transition"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!state.future || state.future.length === 0}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 transition"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Toggle Theme"
          >
            {state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 ml-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 flex flex-col justify-between z-50">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo.jpg"
                    alt="LifeOS Logo"
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                  />
                  <div>
                    <span className="font-extrabold text-base text-zinc-900 dark:text-white">LifeOS</span>
                    <span className="text-[9px] block text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">Personal Suite</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition ${isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </div>
                      {item.id === 'focus' && isTimerRunning && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span>State Stack</span>
                <span className="text-[11px] text-zinc-500">
                  {state.history ? `${state.history.length} changes` : 'Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatch({ type: 'UNDO' })}
                  disabled={!state.history || state.history.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <Undo2 size={14} /> Undo
                </button>
                <button
                  onClick={() => dispatch({ type: 'REDO' })}
                  disabled={!state.future || state.future.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <Redo2 size={14} /> Redo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 md:h-screen md:sticky md:top-0 md:overflow-y-auto bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 flex-col justify-between shrink-0">
        <div>

          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="LifeOS Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-md ring-1 ring-zinc-200 dark:ring-zinc-800"
              />
              <div>
                <span className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
                  LifeOS
                </span>
                <span className="text-[10px] block font-semibold text-zinc-400 dark:text-zinc-500 -mt-0.5 tracking-wider uppercase">
                  Personal Suite
                </span>
              </div>
            </div>

            <button
              onClick={() => dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Toggle Theme"
            >
              {state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <nav className="space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'focus' && isTimerRunning && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400 px-2">
          <span>State Stack</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!state.history || state.history.length === 0}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Undo recent change"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!state.future || state.future.length === 0}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Redo recent change"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-3.5 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        {activeModule === 'dashboard' && (
          <DashboardModule
            onNavigate={setActiveModule}
            onLaunchFocusTask={handleLaunchFocusTask}
            focusTimerState={focusTimerState}
            onStartFocus={handleStartFocus}
          />
        )}
        {activeModule === 'tasks' && (
          <TaskManagerModule onLaunchFocusTask={handleLaunchFocusTask} />
        )}
        {activeModule === 'habits' && <HabitTrackerModule />}
        {activeModule === 'calendar' && <CalendarModule />}
        <div className={activeModule === 'focus' ? 'block' : 'hidden'}>
          <FocusTimerModule
            activeTask={activeFocusTask}
            onClearActiveTask={() => setActiveFocusTask(null)}
            onRunningChange={setIsTimerRunning}
            onTimerTick={setFocusTimerState}
            triggerAutoStart={triggerAutoStartTimer}
            onAutoStartHandled={() => setTriggerAutoStartTimer(false)}
          />
        </div>
        {activeModule === 'goals' && <GoalsModule />}
        {activeModule === 'analytics' && <AnalyticsModule />}
        {activeModule === 'settings' && <SettingsModule />}
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveModule}
        onLaunchFocusTask={handleLaunchFocusTask}
      />
    </div>
  );
}

export default function App() {
  return (
    <LifeOSProvider>
      <LifeOSApp />
    </LifeOSProvider>
  );
}
