import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGate } from './components/RoleGate';
import { AppLayout } from './components/AppLayout';
import Home from './pages/Home/Home';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Browse from './pages/Browse/Browse';
import BookDetail from './pages/Browse/BookDetail';
import MyBooks from './pages/MyBooks/MyBooks';
import EBooks from './pages/EBooks/EBooks';
import EBookReader from './pages/EBooks/EBookReader';
import AdminPanel from './pages/Admin/AdminPanel';
import Profile from './pages/Profile/Profile';
import Restricted from './pages/Restricted';
import BookDomeGallery from './pages/Gallery/BookDomeGallery';
import MysteryDraw from './pages/MysteryDraw/MysteryDraw';
import BaristaCompanion from './components/Barista/BaristaCompanion';

export default function App() {
  return (
    <>
      <BaristaCompanion />
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/gallery" element={<BookDomeGallery />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="mystery-draw"
          element={
            <RoleGate roles={['member', 'librarian']}>
              <MysteryDraw />
            </RoleGate>
          }
        />
        <Route path="browse" element={<Browse />} />
        <Route path="browse/:id" element={<BookDetail />} />
        <Route path="my-books" element={<MyBooks />} />
        <Route path="ebooks" element={<EBooks />} />
        <Route path="ebooks/:id/read" element={<EBookReader />} />
        <Route
          path="admin"
          element={
            <RoleGate roles={['admin', 'librarian']}>
              <AdminPanel />
            </RoleGate>
          }
        />
        <Route path="profile" element={<Profile />} />
        <Route path="restricted" element={<Restricted />} />
      </Route>
    </Routes>
    </>
  );
}
