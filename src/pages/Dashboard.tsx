import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, useAuth } from '../contexts/AuthContext';
import * as Icons from 'lucide-react';

interface CategoryStat {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  institution_count: number;
  account_count: number;
}

const iconMap: Record<string, any> = {
  'landmark': Icons.Landmark,
  'trending-up': Icons.TrendingUp,
  'piggy-bank': Icons.PiggyBank,
  'shield': Icons.Shield,
  'home': Icons.Home,
  'car': Icons.Car,
  'briefcase': Icons.Briefcase,
  'globe': Icons.Globe,
  'credit-card': Icons.CreditCard,
  'file-text': Icons.FileText,
  'calculator': Icons.Calculator,
  'gem': Icons.Gem,
  'repeat': Icons.Repeat,
  'at-sign': Icons.AtSign,
  'zap': Icons.Zap,
  'heart-pulse': Icons.HeartPulse,
  'graduation-cap': Icons.GraduationCap,
  'scale': Icons.Scale,
  'phone': Icons.Phone,
  'heart': Icons.Heart,
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ totalInstitutions: number; totalAccounts: number; categoryCounts: CategoryStat[] } | null>(null);

  useEffect(() => {
    apiFetch('/stats').then(setStats);
  }, []);

  if (!stats) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user?.firstName}. {user?.partner ? `Shared with ${user.partner.firstName} ${user.partner.lastName}.` : 'Link a partner in Settings to share data.'}</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-number">{stats.totalInstitutions}</span>
          <span className="stat-label">Institutions</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalAccounts}</span>
          <span className="stat-label">Accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.categoryCounts.filter(c => c.institution_count > 0).length}</span>
          <span className="stat-label">Active Categories</span>
        </div>
      </div>

      <h3 className="section-title">Estate Planning Categories</h3>
      <div className="category-grid">
        {stats.categoryCounts.map(cat => {
          const IconComponent = iconMap[cat.icon] || Icons.Folder;
          return (
            <div key={cat.id} className="category-card" onClick={() => navigate(`/category/${cat.id}`)}>
              <div className="category-card-icon">
                <IconComponent size={24} />
              </div>
              <div className="category-card-info">
                <h4>{cat.name}</h4>
                <span>{cat.institution_count} institution{cat.institution_count !== 1 ? 's' : ''} · {cat.account_count} account{cat.account_count !== 1 ? 's' : ''}</span>
              </div>
              <Icons.ChevronRight size={18} className="chevron" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
