import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  Check,
  Circle,
  Clock3,
  Flag,
  ListTodo,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'todo-reminder-items';
const FILTERS = ['全部', '待处理', '已完成', '今日', '已逾期'];
const PRIORITIES = {
  low: '低',
  normal: '中',
  high: '高',
};

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

const createTodo = (form) => ({
  id: crypto.randomUUID(),
  title: form.title.trim(),
  note: form.note.trim(),
  dueAt: form.dueAt,
  priority: form.priority,
  completed: false,
  reminded: false,
  createdAt: new Date().toISOString(),
});

export default function App() {
  const [todos, setTodos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState({
    title: '',
    note: '',
    dueAt: nowInputValue(),
    priority: 'normal',
  });
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [notificationStatus, setNotificationStatus] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

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
    };
  }, [todos]);

  const visibleTodos = useMemo(() => {
    return todos
      .filter((todo) => {
        if (filter === '待处理') return !todo.completed;
        if (filter === '已完成') return todo.completed;
        if (filter === '今日') return !todo.completed && isToday(todo.dueAt);
        if (filter === '已逾期') return isOverdue(todo);
        return true;
      })
      .filter((todo) => {
        const text = `${todo.title} ${todo.note}`.toLowerCase();
        return text.includes(query.trim().toLowerCase());
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [filter, query, todos]);

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
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };

  const deleteTodo = (id) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
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

      <section className="workspace">
        <form className="composer" onSubmit={submitTodo}>
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
              placeholder="补充地点、资料或上下文"
              rows={4}
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
            新增待办
          </button>
        </form>

        <section className="list-panel">
          <div className="controls">
            <div className="search-box">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索待办"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="清除搜索">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="segments" role="tablist" aria-label="筛选待办">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  className={filter === item ? 'active' : ''}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="todo-list">
            {visibleTodos.length === 0 ? (
              <div className="empty-state">
                <CalendarClock size={42} />
                <strong>暂无待办</strong>
                <span>添加一个有提醒时间的事项，列表会自动更新。</span>
              </div>
            ) : (
              visibleTodos.map((todo) => (
                <article
                  className={[
                    'todo-card',
                    todo.completed ? 'completed' : '',
                    isOverdue(todo) ? 'overdue' : '',
                    `priority-${todo.priority}`,
                  ].join(' ')}
                  key={todo.id}
                >
                  <button
                    className="check-button"
                    onClick={() => toggleTodo(todo.id)}
                    aria-label={todo.completed ? '标记为待处理' : '标记为已完成'}
                    type="button"
                  >
                    {todo.completed ? <Check size={18} /> : <Circle size={18} />}
                  </button>
                  <div className="todo-content">
                    <div className="todo-title-row">
                      <h2>{todo.title}</h2>
                      <span className="priority-pill">
                        <Flag size={13} />
                        {PRIORITIES[todo.priority]}
                      </span>
                    </div>
                    {todo.note && <p>{todo.note}</p>}
                    <div className="meta-row">
                      <span>
                        <Clock3 size={14} />
                        {formatDateTime(todo.dueAt)}
                      </span>
                      {isOverdue(todo) && <b>已逾期</b>}
                    </div>
                  </div>
                  <button
                    className="delete-button"
                    onClick={() => deleteTodo(todo.id)}
                    aria-label="删除待办"
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
