import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStats } from '../lib/storage';
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

interface RootCategory {
  name: string;
  icon: any;
  categoryIds: string[];
}

const rootCategories: RootCategory[] = [
  {
    name: 'Financial Accounts',
    icon: Icons.DollarSign,
    categoryIds: ['bank-accounts', 'investment-accounts', 'retirement-accounts', 'debts-liabilities'],
  },
  {
    name: 'Insurance & Protection',
    icon: Icons.ShieldCheck,
    categoryIds: ['insurance-policies', 'healthcare'],
  },
  {
    name: 'Property & Assets',
    icon: Icons.Home,
    categoryIds: ['real-estate', 'vehicles', 'personal-property'],
  },
  {
    name: 'Business & Legal',
    icon: Icons.Briefcase,
    categoryIds: ['business-interests', 'trusts-entities', 'estate-documents', 'tax-records'],
  },
  {
    name: 'Digital Life',
    icon: Icons.Globe,
    categoryIds: ['digital-assets', 'social-media', 'subscriptions'],
  },
  {
    name: 'Everyday & Utilities',
    icon: Icons.Zap,
    categoryIds: ['utilities', 'education'],
  },
  {
    name: 'People & Wishes',
    icon: Icons.Heart,
    categoryIds: ['emergency-contacts', 'final-wishes'],
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ totalInstitutions: number; totalAccounts: number; categoryCounts: CategoryStat[] } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(rootCategories.map(r => r.name)));

  useEffect(() => {
    if (user) {
      getStats(user.id).then(setStats);
    }
  }, [user]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (!stats) return <div className="loading">Loading...</div>;

  const catMap = new Map(stats.categoryCounts.map(c => [c.id, c]));

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

      <div className="root-categories">
        {rootCategories.map(group => {
          const GroupIcon = group.icon;
          const isExpanded = expandedGroups.has(group.name);
          const groupCats = group.categoryIds.map(id => catMap.get(id)).filter(Boolean) as CategoryStat[];
          const groupInsts = groupCats.reduce((s, c) => s + c.institution_count, 0);
          const groupAccts = groupCats.reduce((s, c) => s + c.account_count, 0);

          return (
            <div key={group.name} className="root-category">
              <div className="root-category-header" onClick={() => toggleGroup(group.name)}>
                <div className="root-category-icon">
                  <GroupIcon size={20} />
                </div>
                <div className="root-category-info">
                  <h3>{group.name}</h3>
                  <span>{groupInsts} institution{groupInsts !== 1 ? 's' : ''} · {groupAccts} account{groupAccts !== 1 ? 's' : ''}</span>
                </div>
                <div className="root-category-toggle">
                  {isExpanded ? <Icons.ChevronDown size={18} /> : <Icons.ChevronRight size={18} />}
                </div>
              </div>

              {isExpanded && (
                <div className="category-tile-grid">
                  {groupCats.map(cat => {
                    const IconComponent = iconMap[cat.icon] || Icons.Folder;
                    const hasData = cat.institution_count > 0;
                    return (
                      <div key={cat.id} className={`category-tile ${hasData ? 'has-data' : ''}`} onClick={() => navigate(`/category/${cat.id}`)}>
                        <div className="category-tile-icon">
                          <IconComponent size={28} />
                        </div>
                        <span className="category-tile-name">{cat.name}</span>
                        {hasData && (
                          <span className="category-tile-count">
                            {cat.institution_count} · {cat.account_count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
