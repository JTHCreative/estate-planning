import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Settings } from 'lucide-react';
import logo from '../assets/logo.svg';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="Estate Planner" className="sidebar-logo" />
          <h1>Estate Planner</h1>
        </div>
        <div className="sidebar-user">
          <span>{user?.firstName} {user?.lastName}</span>
          <span className="user-email">{user?.email}</span>
        </div>
        <div className="sidebar-links">
          <NavLink to="/" end><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/settings"><Settings size={18} /> Settings</NavLink>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} /> Sign Out
        </button>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
