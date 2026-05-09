import './globals.css';

export const metadata = {
  title: '待办提醒',
  description: '安排事项、设置到期时间，并在浏览器中收到提醒。',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
