'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BarChart3,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Flag,
  History,
  Lightbulb,
  ListTodo,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'todo-reminder-items';
const SCHEDULE_RANGES = ['过去7天', '近30天', '未来计划'];
const PRIORITIES = {
  low: '低',
  normal: '中',
  high: '高',
};
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
const MEAL_SUGGESTIONS = [
  '番茄牛腩饭 + 紫菜蛋花汤',
  '鸡胸肉蔬菜卷 + 玉米汤',
  '香菇滑鸡饭 + 清炒时蔬',
  '三鲜米线 + 凉拌黄瓜',
  '虾仁蛋炒饭 + 冬瓜汤',
];

const nowInputValue = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 30);
  return now.toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return '未设置';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const isToday = (value) => {
  if (!value) return false;
  const target = new Date(value);
  const today = new Date();
  return target.toDateString() === today.toDateString();
};

const isOverdue = (todo) => {
  return todo.dueAt && !todo.completed && new Date(todo.dueAt).getTime() < Date.now();
};

const getHistoryTime = (todo) => todo.completedAt || todo.dueAt || todo.createdAt;
const getTodoDayTime = (todo) => todo.dueAt || todo.completedAt || todo.createdAt;
const getStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDayTitle = (value) => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date(value));
};

const isRecentHistory = (todo) => {
  if (!todo.completed) return false;
  const historyTime = getHistoryTime(todo);
  if (!historyTime) return false;

  const timestamp = new Date(historyTime).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= MONTH_IN_MS;
};

const isFuturePlan = (todo) => {
  if (todo.completed || !todo.dueAt) return false;
  return getStartOfDay(todo.dueAt).getTime() > getStartOfDay(new Date()).getTime();
};

const isUnfinishedPastOrToday = (todo) => {
  return !todo.completed && !isFuturePlan(todo);
};

const getTodoStatus = (todo) => {
  if (todo.completed) return '已完成';
  if (isOverdue(todo)) return '已逾期';
  if (isFuturePlan(todo)) return '计划中';
  return '未完成';
};

const getTodoStatusTone = (todo) => {
  if (todo.completed) return 'completed';
  if (isOverdue(todo)) return 'overdue';
  if (isFuturePlan(todo)) return 'planned';
  return 'pending';
};

const getScheduleSummary = (items) => {
  const completed = items.filter((todo) => todo.completed).length;
  const planned = items.filter(isFuturePlan).length;
  const pending = items.filter(isUnfinishedPastOrToday).length;
  const total = items.length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    pending,
    planned,
    completionRate,
  };
};

const getScheduleRangeItems = (todos, range) => {
  const today = getStartOfDay(new Date());

  return todos.filter((todo) => {
    const todoTime = getTodoDayTime(todo);
    if (!todoTime) return false;

    const todoDay = getStartOfDay(todoTime).getTime();
    const diffDays = Math.round((today.getTime() - todoDay) / (24 * 60 * 60 * 1000));

    if (range === '过去7天') return diffDays >= 0 && diffDays < 7;
    if (range === '未来计划') return isFuturePlan(todo);
    return diffDays >= 0 && diffDays < 30;
  });
};

const matchesScheduleQuery = (todo, query) => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  const searchableText = [
    todo.title,
    todo.note,
    toDateKey(getTodoDayTime(todo)),
    formatDateTime(getTodoDayTime(todo)),
    getTodoStatus(todo),
  ]
    .join(' ')
    .toLowerCase();

  return searchableText.includes(keyword);
};

const buildMonthDays = (todos, selectedDate) => {
  const monthStart = new Date(`${selectedDate.slice(0, 7)}-01T00:00`);
  const firstDayOffset = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstDayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toDateKey(date);
    const items = todos.filter((todo) => toDateKey(getTodoDayTime(todo)) === key);

    return {
      key,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isSelected: key === selectedDate,
      isToday: key === toDateKey(new Date()),
      hasCompleted: items.some((todo) => todo.completed),
      hasPending: items.some(isUnfinishedPastOrToday),
      hasPlanned: items.some(isFuturePlan),
      hasOverdue: items.some(isOverdue),
    };
  });
};

const getMonthLabel = (selectedDate) => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDate}T00:00`));
};

const sortScheduleItems = (items) => {
  return [...items].sort((a, b) => {
    const aTime = new Date(getTodoDayTime(a)).getTime();
    const bTime = new Date(getTodoDayTime(b)).getTime();
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return aTime - bTime;
  });
};

const sortTodayItems = (items) => {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
};

const getTimeLabel = (value) => {
  if (!value) return '未设置';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getDayPeriod = (value) => {
  const hour = new Date(value).getHours();
  if (hour < 12) return '上午';
  if (hour < 18) return '下午';
  return '晚上';
};

const getRhythmGroups = (items) => {
  return ['上午', '下午', '晚上'].map((period) => ({
    period,
    items: items.filter((todo) => getDayPeriod(todo.dueAt) === period),
  }));
};

const createTodo = (form) => ({
  id: crypto.randomUUID(),
  title: form.title.trim(),
  note: form.note.trim(),
  dueAt: form.dueAt,
  priority: form.priority,
  completed: false,
  completedAt: null,
  reminded: false,
  createdAt: new Date().toISOString(),
});

export default function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [form, setForm] = useState({
    title: '',
    note: '',
    dueAt: nowInputValue(),
    priority: 'normal',
  });
  const [activeView, setActiveView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [scheduleQuery, setScheduleQuery] = useState('');
  const [scheduleRange, setScheduleRange] = useState('近30天');
  const [scheduleViewMode, setScheduleViewMode] = useState('range');
  const [mealIndex, setMealIndex] = useState(0);
  const [isRhythmExpanded, setIsRhythmExpanded] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('unsupported');

  useEffect(() => {
    try {
      setTodos(JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []);
    } catch {
      setTodos([]);
    } finally {
      setIsLoaded(true);
    }

    setNotificationStatus(
      typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    );
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [isLoaded, todos]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodos((current) =>
        current.map((todo) => {
          if (!todo.dueAt || todo.completed || todo.reminded) return todo;
          if (new Date(todo.dueAt).getTime() > Date.now()) return todo;

          if (Notification.permission === 'granted') {
            new Notification('待办事项提醒', {
              body: todo.title,
            });
          }

          return { ...todo, reminded: true };
        }),
      );
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const active = todos.filter((todo) => !todo.completed);
    return {
      total: todos.length,
      active: active.length,
      overdue: todos.filter(isOverdue).length,
      today: todos.filter((todo) => !todo.completed && isToday(todo.dueAt)).length,
      recentHistory: todos.filter(isRecentHistory).length,
      planned: todos.filter(isFuturePlan).length,
    };
  }, [todos]);

  const monthDays = useMemo(() => buildMonthDays(todos, selectedDate), [selectedDate, todos]);
  const scheduleRangeItems = useMemo(
    () => getScheduleRangeItems(todos, scheduleRange),
    [scheduleRange, todos],
  );
  const scheduleBaseItems = useMemo(() => {
    if (scheduleViewMode === 'range') return scheduleRangeItems;
    return todos.filter((todo) => toDateKey(getTodoDayTime(todo)) === selectedDate);
  }, [scheduleRangeItems, scheduleViewMode, selectedDate, todos]);
  const selectedDateItems = useMemo(() => {
    const sourceItems = scheduleQuery.trim()
      ? scheduleBaseItems.filter((todo) => matchesScheduleQuery(todo, scheduleQuery))
      : scheduleBaseItems;

    return sortScheduleItems(sourceItems);
  }, [scheduleBaseItems, scheduleQuery]);
  const scheduleResultTitle = scheduleQuery.trim()
    ? `搜索结果 · ${scheduleViewMode === 'range' ? scheduleRange : formatDayTitle(`${selectedDate}T00:00`)}`
    : scheduleViewMode === 'range'
      ? scheduleRange
      : formatDayTitle(`${selectedDate}T00:00`);
  const scheduleSummary = useMemo(() => getScheduleSummary(selectedDateItems), [selectedDateItems]);
  const scheduleProgress = {
    completed: scheduleSummary.total
      ? (scheduleSummary.completed / scheduleSummary.total) * 100
      : 0,
    pending: scheduleSummary.total ? (scheduleSummary.pending / scheduleSummary.total) * 100 : 0,
    planned: scheduleSummary.total ? (scheduleSummary.planned / scheduleSummary.total) * 100 : 0,
  };
  const todayTodos = useMemo(
    () => sortTodayItems(todos.filter((todo) => isToday(todo.dueAt))),
    [todos],
  );
  const todayCompleted = todayTodos.filter((todo) => todo.completed).length;
  const todayProgress = todayTodos.length ? (todayCompleted / todayTodos.length) * 100 : 0;
  const todayRemaining = todayTodos.length - todayCompleted;
  const nextTodayTodo = todayTodos.find((todo) => !todo.completed);
  const hasHighPriorityToday = todayTodos.some((todo) => !todo.completed && todo.priority === 'high');
  const hasOverdueToday = todayTodos.some(isOverdue);
  const focusSuggestion = hasOverdueToday
    ? '先处理已逾期事项'
    : hasHighPriorityToday
      ? '先做高优先级'
      : '先完成最小一步';
  const timelineItems = todayTodos.slice(0, 6);
  const rhythmGroups = useMemo(() => getRhythmGroups(todayTodos), [todayTodos]);
  const mealSuggestion = MEAL_SUGGESTIONS[mealIndex % MEAL_SUGGESTIONS.length];

  const requestNotification = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
  };

  const submitTodo = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setTodos((current) => [createTodo(form), ...current]);
    setForm({
      title: '',
      note: '',
      dueAt: nowInputValue(),
      priority: 'normal',
    });
  };

  const toggleTodo = (id) => {
    setTodos((current) =>
      current.map((todo) => {
        if (todo.id !== id) return todo;
        const completed = !todo.completed;
        return {
          ...todo,
          completed,
          completedAt: completed ? new Date().toISOString() : null,
        };
      }),
    );
  };

  const deleteTodo = (id) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  };

  const addMealMemo = () => {
    setTodos((current) => [
      createTodo({
        title: `今天吃什么：${mealSuggestion}`,
        note: '忙的时候也要好好吃饭。',
        dueAt: nowInputValue(),
        priority: 'low',
      }),
      ...current,
    ]);
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <div className="brand">
            <ListTodo size={28} />
            <h1>待办提醒</h1>
          </div>
          <p>安排事项、设置到期时间，并在浏览器中收到提醒。</p>
        </div>
        <button
          className="icon-text-button"
          onClick={requestNotification}
          disabled={notificationStatus === 'granted' || notificationStatus === 'unsupported'}
          type="button"
        >
          <Bell size={18} />
          {notificationStatus === 'granted' ? '通知已开启' : '开启通知'}
        </button>
      </section>

      <section className="summary-grid" aria-label="待办统计">
        <div>
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>待处理</span>
          <strong>{stats.active}</strong>
        </div>
        <div>
          <span>今日</span>
          <strong>{stats.today}</strong>
        </div>
        <div className={stats.overdue ? 'danger' : ''}>
          <span>已逾期</span>
          <strong>{stats.overdue}</strong>
        </div>
      </section>

      <nav className="view-nav" aria-label="待办导航">
        <button
          className={activeView === 'today' ? 'active' : ''}
          onClick={() => setActiveView('today')}
          type="button"
        >
          <CalendarClock size={18} />
          今日待办
        </button>
        <button
          className={activeView === 'schedule' ? 'active' : ''}
          onClick={() => setActiveView('schedule')}
          type="button"
        >
          <History size={18} />
          日程总览
          <span>{stats.planned}</span>
        </button>
      </nav>

      {activeView === 'today' ? (
        <section className="today-workspace">
          <section className="today-list-panel" aria-label="今日清单">
            <div className="today-panel-header">
              <div>
                <h2>今日清单</h2>
                <p>只看今天要处理的事项，保持轻一点。</p>
              </div>
              <span>已完成 {todayCompleted} / {todayTodos.length}</span>
            </div>
            <div className="today-progress" aria-label={`今日完成度 ${Math.round(todayProgress)}%`}>
              <span style={{ width: `${todayProgress}%` }} />
            </div>

            <div className="today-list-scroll">
              <div className="today-list">
              {todayTodos.length === 0 ? (
                <div className="empty-state">
                  <CalendarClock size={42} />
                  <strong>今日暂无待办</strong>
                  <span>右侧新增待办可选择今天，也可以安排到未来。</span>
                </div>
              ) : (
                todayTodos.map((todo) => {
                  const status = getTodoStatus(todo);
                  const tone = getTodoStatusTone(todo);
                  return (
                    <article className={`today-row status-${tone}`} key={todo.id}>
                      <button
                        className="check-button"
                        onClick={() => toggleTodo(todo.id)}
                        aria-label={todo.completed ? '标记为待处理' : '标记为已完成'}
                        type="button"
                      >
                        {todo.completed ? <Check size={18} /> : <Circle size={18} />}
                      </button>
                      <div className="today-row-main">
                        <h3>{todo.title}</h3>
                        {todo.note && <p>{todo.note}</p>}
                      </div>
                      <span className="today-time">
                        <Clock3 size={14} />
                        {formatDateTime(todo.dueAt)}
                      </span>
                      <span className="priority-pill">{PRIORITIES[todo.priority]}</span>
                      <span className={`status-pill status-${tone}`}>{status}</span>
                      <button
                        className="delete-button"
                        onClick={() => deleteTodo(todo.id)}
                        aria-label="删除待办"
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </article>
                  );
                })
              )}
              </div>
            </div>

            <section className="today-rhythm" aria-label="今日节奏">
              <div className="rhythm-header">
                <div>
                  <h3>今日节奏</h3>
                  <span>自动根据今日清单更新</span>
                </div>
                <button
                  className={isRhythmExpanded ? 'expanded' : ''}
                  onClick={() => setIsRhythmExpanded((current) => !current)}
                  type="button"
                >
                  {isRhythmExpanded ? '收起节奏' : '展开节奏'}
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="rhythm-cards">
                <div>
                  <Clock3 size={18} />
                  <span>下一项</span>
                  <strong>
                    {nextTodayTodo
                      ? `${getTimeLabel(nextTodayTodo.dueAt)} ${nextTodayTodo.title}`
                      : '暂无待办'}
                  </strong>
                </div>
                <div>
                  <Circle size={18} />
                  <span>剩余</span>
                  <strong>{todayRemaining} 项</strong>
                </div>
                <div>
                  <Lightbulb size={18} />
                  <span>专注建议</span>
                  <strong>{focusSuggestion}</strong>
                </div>
              </div>
              <div className="rhythm-timeline" aria-label="今日时间轴">
                {timelineItems.length === 0 ? (
                  <span className="rhythm-empty">添加今日待办后会生成时间轴</span>
                ) : (
                  timelineItems.map((todo) => (
                    <span
                      className={[
                        'timeline-point',
                        todo.completed ? 'done' : '',
                        todo.id === nextTodayTodo?.id ? 'active' : '',
                      ].join(' ')}
                      key={todo.id}
                    >
                      <i />
                      <b>{getTimeLabel(todo.dueAt)}</b>
                    </span>
                  ))
                )}
              </div>
              {isRhythmExpanded && (
                <div className="rhythm-detail">
                  {todayTodos.length === 0 ? (
                    <div className="rhythm-detail-empty">
                      今天还没有安排，新增待办后这里会按时间段展开。
                    </div>
                  ) : (
                    rhythmGroups.map((group) => (
                      <section className="rhythm-period" key={group.period}>
                        <h4>{group.period}</h4>
                        {group.items.length === 0 ? (
                          <span>暂无安排</span>
                        ) : (
                          group.items.map((todo) => {
                            const status = getTodoStatus(todo);
                            const tone = getTodoStatusTone(todo);
                            return (
                              <article className={`rhythm-detail-item status-${tone}`} key={todo.id}>
                                <time>{getTimeLabel(todo.dueAt)}</time>
                                <div>
                                  <strong>{todo.title}</strong>
                                  {todo.note && <p>{todo.note}</p>}
                                </div>
                                <span className="priority-pill">{PRIORITIES[todo.priority]}</span>
                                <span className={`status-pill status-${tone}`}>{status}</span>
                              </article>
                            );
                          })
                        )}
                      </section>
                    ))
                  )}
                </div>
              )}
            </section>
          </section>

          <aside className="today-side">
            <form className="today-composer" onSubmit={submitTodo}>
              <div className="side-panel-title">
                <Plus size={20} />
                <h2>新增待办</h2>
              </div>
              <label>
                <span>事项</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="例如：准备周会材料"
                />
              </label>
              <label>
                <span>备注</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  placeholder="补充备注"
                  rows={3}
                />
              </label>
              <div className="form-row">
                <label>
                  <span>提醒时间</span>
                  <input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
                  />
                </label>
                <label>
                  <span>优先级</span>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  >
                    {Object.entries(PRIORITIES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="primary-button" type="submit">
                <Plus size={18} />
                添加到日程
              </button>
            </form>

            <section className="meal-card" aria-label="今天吃什么">
              <div className="meal-card-title">
                <Utensils size={24} />
                <div>
                  <h2>今天吃什么</h2>
                  <p>忙的时候也要好好吃饭。</p>
                </div>
              </div>
              <strong>{mealSuggestion}</strong>
              <div className="meal-actions">
                <button
                  onClick={() => setMealIndex((current) => current + 1)}
                  type="button"
                >
                  <Shuffle size={16} />
                  换一个
                </button>
                <button onClick={addMealMemo} type="button">
                  <Bookmark size={16} />
                  加入备忘
                </button>
              </div>
            </section>
          </aside>
        </section>
      ) : (
        <section className="schedule-panel" aria-label="日程总览">
          <div className="schedule-header">
            <div>
              <h2>日程总览</h2>
              <p>按日期查看过去记录与未来计划。</p>
            </div>
            <div className="schedule-total">
              <BarChart3 size={18} />
              <span>{stats.recentHistory} 项已完成 · {stats.planned} 项计划中</span>
            </div>
          </div>

          <div className="schedule-controls">
            <label>
              <span>选择日期</span>
              <input
                type="date"
                value={selectedDate}
                onInput={(event) => {
                  setSelectedDate(event.currentTarget.value);
                  setScheduleViewMode('date');
                }}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setScheduleViewMode('date');
                }}
              />
            </label>
            <label className="schedule-search">
              <span>手动搜索</span>
              <div className="search-box">
                <Search size={17} />
                <input
                  value={scheduleQuery}
                  onChange={(event) => setScheduleQuery(event.target.value)}
                  placeholder="搜索事项、备注或日期"
                />
                {scheduleQuery && (
                  <button type="button" onClick={() => setScheduleQuery('')} aria-label="清除搜索">
                    <X size={16} />
                  </button>
                )}
              </div>
            </label>
            <div className="schedule-range" role="tablist" aria-label="日程范围">
              {SCHEDULE_RANGES.map((range) => (
                <button
                  className={scheduleViewMode === 'range' && scheduleRange === range ? 'active' : ''}
                  key={range}
                  onClick={() => {
                    setScheduleRange(range);
                    setScheduleViewMode('range');
                  }}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="schedule-grid">
            <section className="calendar-panel" aria-label={`${getMonthLabel(selectedDate)}日历`}>
              <div className="calendar-header">
                <strong>{getMonthLabel(selectedDate)}</strong>
                <span>点选日期查看当天待办</span>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {monthDays.map((day) => (
                  <button
                    className={[
                      'calendar-day',
                      day.isCurrentMonth ? '' : 'muted',
                      day.isSelected ? 'selected' : '',
                      day.isToday ? 'today' : '',
                    ].join(' ')}
                    key={day.key}
                    onClick={() => {
                      setSelectedDate(day.key);
                      setScheduleViewMode('date');
                      setScheduleQuery('');
                    }}
                    type="button"
                  >
                    <span>{day.day}</span>
                    <i>
                      {day.hasCompleted && <b className="dot-completed" />}
                      {(day.hasPending || day.hasPlanned) && <b className="dot-planned" />}
                      {day.hasOverdue && <b className="dot-overdue" />}
                    </i>
                  </button>
                ))}
              </div>
              <div className="calendar-legend">
                <span><b className="dot-completed" />已完成</span>
                <span><b className="dot-planned" />待办/计划</span>
                <span><b className="dot-overdue" />已逾期</span>
              </div>
            </section>

            <section className="schedule-results">
              <div className="schedule-metrics">
                <div>
                  <span>完成度</span>
                  <strong>{scheduleSummary.completionRate}%</strong>
                </div>
                <div>
                  <span>已完成</span>
                  <strong>{scheduleSummary.completed}</strong>
                </div>
                <div>
                  <span>未完成</span>
                  <strong>{scheduleSummary.pending}</strong>
                </div>
                <div>
                  <span>计划中</span>
                  <strong>{scheduleSummary.planned}</strong>
                </div>
              </div>
              <div className="schedule-progress" aria-label={`完成度 ${scheduleSummary.completionRate}%`}>
                <span className="progress-completed" style={{ width: `${scheduleProgress.completed}%` }} />
                <span className="progress-pending" style={{ width: `${scheduleProgress.pending}%` }} />
                <span className="progress-planned" style={{ width: `${scheduleProgress.planned}%` }} />
              </div>
              <p className="schedule-status">
                {scheduleSummary.total
                  ? `还有 ${scheduleSummary.pending} 项未完成，${scheduleSummary.planned} 项未来计划。`
                  : '当前条件下暂无待办记录。'}
              </p>

              <div className="result-heading">
                <h3>{scheduleResultTitle}</h3>
                <span>{scheduleSummary.total} 项</span>
              </div>
              <div className="schedule-list">
                {selectedDateItems.length === 0 ? (
                  <div className="schedule-empty">
                    <CalendarClock size={34} />
                    <strong>暂无记录</strong>
                    <span>可以选择其他日期，或输入关键词搜索待办。</span>
                  </div>
                ) : (
                  selectedDateItems.map((todo) => {
                    const status = getTodoStatus(todo);
                    const tone = getTodoStatusTone(todo);
                    return (
                      <article className={`schedule-item status-${tone}`} key={todo.id}>
                        <div className="schedule-item-icon">
                          {todo.completed ? <Check size={16} /> : <Circle size={16} />}
                        </div>
                        <div className="schedule-item-main">
                          <div className="schedule-item-title">
                            <h4>{todo.title}</h4>
                            <span className={`status-pill status-${tone}`}>{status}</span>
                          </div>
                          {todo.note && <p>{todo.note}</p>}
                          <div className="meta-row">
                            <span>
                              <Clock3 size={14} />
                              {formatDateTime(getTodoDayTime(todo))}
                            </span>
                            <span>
                              <Flag size={14} />
                              优先级 {PRIORITIES[todo.priority]}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
