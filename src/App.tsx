import { useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Logo } from './components/Logo'
import { Bookmarks } from './pages/Bookmarks'
import { Channels } from './pages/Channels'
import { Explore } from './pages/Explore'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Messages } from './pages/Messages'
import { Notifications } from './pages/Notifications'
import { PostThread } from './pages/PostThread'
import { Profile } from './pages/Profile'
import { useApp } from './store'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <Home /> },
      { path: 'explore', element: <Explore /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'messages', element: <Messages /> },
      { path: 'messages/:peerId', element: <Messages /> },
      { path: 'channels', element: <Channels /> },
      { path: 'bookmarks', element: <Bookmarks /> },
      { path: 'profile', element: <Profile /> },
      { path: 'u/:peerId', element: <Profile /> },
      { path: 'post/:peerId/:msgId', element: <PostThread /> },
      // "/@username" — mentions and t.me-style handles
      { path: ':handle', element: <Profile /> },
    ],
  },
])

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Logo className="size-[72px] animate-pulse" />
    </div>
  )
}

export function App() {
  const status = useApp((s) => s.status)
  const boot = useApp((s) => s.boot)
  useEffect(() => {
    boot()
  }, [boot])
  if (status === 'boot') return <Splash />
  if (status === 'auth') return <Login />
  return <RouterProvider router={router} />
}
