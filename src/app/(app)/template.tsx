// Templates remount on every navigation, so each page fades in.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
