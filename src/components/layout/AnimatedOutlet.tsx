import { useLocation, Outlet } from 'react-router-dom'

export function AnimatedOutlet() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter">
      <Outlet />
    </div>
  )
}
