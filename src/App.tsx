/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Plus, 
  LogOut, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  BarChart3,
  ChevronDown,
  Info,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { DISTRICTS, CATEGORIES } from './constants';
import { UserSession, EventData } from './types';

// Simple Alert Component
const Alert = ({ message, type = 'error' }: { message: string, type?: 'error' | 'success' }) => (
  <motion.div 
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`p-3 rounded-lg text-xs font-semibold mb-4 ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
  >
    {message}
  </motion.div>
);

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'calendar'>('dashboard');
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<EventData>>({
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    location: '',
    category: CATEGORIES[0],
    count: undefined,
    budget: undefined,
    pic: '',
    phone: ''
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load session from local storage
  useEffect(() => {
    // Safety timeout to prevent permanent loading screen
    const timeout = setTimeout(() => setIsLoading(false), 5000);

    try {
      const savedSession = localStorage.getItem('sipesbar_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && typeof parsed === 'object') {
          setSession(parsed);
          setIsLoginOpen(false);
        }
      }
    } catch (err) {
      console.error("Session load error:", err);
      localStorage.removeItem('sipesbar_session');
    } finally {
      setIsLoading(false);
      clearTimeout(timeout);
    }
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  // Fetch events on session or periodic
  useEffect(() => {
    if (session) {
      fetchEvents();
      const interval = setInterval(fetchEvents, 5000); // Poll every 5s for real-time feel
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDistrictId || !passcode) {
      setLoginError('Pilih instansi dan masukkan kode akses.');
      return;
    }

    try {
      setLoginError('');
      setIsLoading(true);
      
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: selectedDistrictId, passcode })
      });

      if (res.ok) {
        const data = await res.json();
        const district = DISTRICTS.find(d => d.id === selectedDistrictId);
        const newSession: UserSession = {
          districtId: selectedDistrictId,
          districtName: district?.name || '',
          role: data.role
        };
        
        setSession(newSession);
        localStorage.setItem('sipesbar_session', JSON.stringify(newSession));
        setIsLoginOpen(false);
        setPasscode('');
      } else {
        const errData = await res.json();
        setLoginError('Kode akses salah atau terjadi kesalahan server.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('sipesbar_session');
    setSession(null);
    setIsLoginOpen(true);
  };

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           e.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDistrict = filterDistrict === 'all' || e.districtId === filterDistrict;
      const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
      const matchesDateRange = (!filterDateStart || e.startDate >= filterDateStart) && 
                              (!filterDateEnd || e.startDate <= filterDateEnd);
      
      return matchesSearch && matchesDistrict && matchesCategory && matchesDateRange;
    });
  }, [events, searchQuery, filterDistrict, filterCategory, filterDateStart, filterDateEnd]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      upcoming: events.filter(e => new Date(e.startDate) >= new Date()).length,
      thisMonth: events.filter(e => {
        const d = new Date(e.startDate);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length
    };
  }, [events]);

  const handleUpsertEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;

    try {
      const eventPayload = {
        title: formData.title || '',
        description: formData.description || '',
        startDate: formData.startDate || '',
        endDate: formData.endDate || '',
        location: formData.location || '',
        category: formData.category || CATEGORIES[0],
        count: Number(formData.count) || 0,
        budget: Number(formData.budget) || 0,
        pic: formData.pic || '',
        phone: formData.phone || '',
        districtId: editingEvent ? editingEvent.districtId : session.districtId,
        districtName: editingEvent ? editingEvent.districtName : session.districtName,
      };

      const url = editingEvent?.id ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      });

      if (res.ok) {
        setIsFormOpen(false);
        setEditingEvent(null);
        setFormData({
          title: '',
          description: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          location: '',
          category: CATEGORIES[0],
          count: undefined,
          budget: undefined,
          pic: '',
          phone: ''
        });
        fetchEvents();
      } else {
        alert('Gagal menyimpan data.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data. Periksa koneksi.');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);
    const isOwner = session?.districtId === eventToDelete?.districtId;
    const isProvince = session?.role === 'province';

    if (!isProvince && !isOwner) {
      alert('Anda tidak memiliki izin untuk menghapus event ini.');
      return;
    }
    
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEvents();
        setIsDeleting(null);
      } else {
        alert('Gagal menghapus event.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus event.');
    }
  };

  const handleExportExcel = () => {
    if (events.length === 0) return;
    
    const excelData = events.map(e => ({
      'Judul Event': e.title,
      'Kategori': e.category,
      'Tanggal Mulai': e.startDate,
      'Tanggal Selesai': e.endDate,
      'Lokasi': e.location,
      'Kabupaten/Kota': e.districtName,
      'Penyelenggara': e.pic || '-',
      'No. Telp': e.phone || '-',
      'Estimasi Peserta': e.count,
      'Estimasi Anggaran': e.budget,
      'Deskripsi': e.description,
      'Dibuat Pada': e.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Event');
    
    // Auto-size columns
    const maxWidths = Object.keys(excelData[0] || {}).map(key => {
      return Math.max(
        key.length,
        ...excelData.map(row => String((row as any)[key]).length)
      );
    });
    worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

    XLSX.writeFile(workbook, `Laporan-Event-Sumbar-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getRoleBadge = (event: EventData) => {
    if (session?.districtId === event.districtId) {
      return (
        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase ml-2">
          Milik Anda
        </span>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="font-bold text-slate-400 text-sm animate-pulse">Menghubungkan ke Server...</p>
        </div>
      </div>
    );
  }

  if (isLoginOpen && !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full border border-slate-200"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-xl mb-4 text-white shadow-sm">
              <BarChart3 size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SIPESBAR</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem Informasi Pendataan Event Sumatera Barat</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <Alert message={loginError} />}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Pilih Instansi</label>
              <div className="relative">
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none appearance-none transition-all text-sm"
                >
                  <option value="">-- Pilih Dinas Pariwisata --</option>
                  {DISTRICTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Kode Akses</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Masukkan kode akses"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm active:scale-[0.98] mt-2"
            >
              Masuk ke Dashboard
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-start gap-3 text-xs text-slate-400">
            <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
            <p>Khusus internal Dinas Pariwisata se-Sumatera Barat. Hubungi admin Provinsi untuk bantuan akses.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <nav className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white font-bold text-sm">SB</div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            SIPESBAR <span className="text-slate-400 font-normal ml-1 hidden sm:inline">| Data Event Pariwisata</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Instansi Terdaftar</p>
            <p className="text-sm font-semibold text-slate-700">{session?.districtName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
              <UserSessionIcon />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
              title="Keluar"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100-4rem)]">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 p-8 flex-col gap-8 shrink-0">
          <button 
            onClick={() => {
              setEditingEvent(null);
              setFormData({
                title: '',
                description: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                location: '',
                category: CATEGORIES[0],
                count: undefined,
                budget: undefined,
                pic: '',
                phone: ''
              });
              setIsFormOpen(true);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold shadow-sm shadow-emerald-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus size={18} />
            Tambah Event Baru
          </button>
          
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-3">Menu Utama</p>
            <button 
              onClick={() => {
                setActiveView('dashboard');
                setFilterDistrict('all');
                setFilterCategory('all');
                setFilterDateStart('');
                setFilterDateEnd('');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeView === 'dashboard' && filterDistrict === 'all' && filterCategory === 'all' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <BarChart3 size={18} />
              Semua Event
            </button>
            <button 
              onClick={() => setActiveView('calendar')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeView === 'calendar' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <CalendarDays size={18} />
              Kalender Event
            </button>
            {session?.districtId !== 'provinsi' && (
              <button 
                onClick={() => {
                  setActiveView('dashboard');
                  setFilterDistrict(session?.districtId || 'all');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeView === 'dashboard' && filterDistrict === session?.districtId ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <MapPin size={18} />
                Event {session?.districtName.split(' ').slice(-1)}
              </button>
            )}
          </div>

          <div className="mt-auto space-y-4">
            <button 
              onClick={handleExportExcel}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors border border-transparent hover:border-slate-100"
            >
              <BarChart3 size={18} className="text-emerald-600" />
              Unduh Laporan Excel
            </button>
            
            <div className="pt-4 flex flex-col items-center">
              <p className="text-[9px] text-slate-300 font-bold tracking-widest uppercase mb-1">Design by Minangkaos</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 md:p-12 overflow-y-auto">
          {activeView === 'calendar' ? (
            <CalendarView events={events} />
          ) : (
            <>
              {/* Dashboard Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {[
              { label: 'Total Event Provinsi', value: stats.total, color: 'text-slate-800' },
              { label: 'Event Mendatang', value: stats.upcoming, color: 'text-emerald-600' },
              { label: 'Bulan Aktif (Ini)', value: stats.thisMonth, color: 'text-slate-800' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
              >
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className={`text-4xl font-bold ${stat.color}`}>{stat.value}</h3>
              </motion.div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <input 
                  type="text" 
                  placeholder="Cari nama event atau lokasi..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 transition-all"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>

              {/* District Filter (Desktop Side) */}
              <div>
                <select 
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                >
                  <option value="all">Semua Kabupaten/Kota</option>
                  {DISTRICTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                >
                  <option value="all">Semua Kategori</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter Toggle / Range */}
              <div className="flex gap-2">
                <input 
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="w-full text-[10px] border border-slate-200 rounded-xl px-2 py-2 bg-slate-50 outline-none"
                  title="Tanggal Mulai"
                />
                <input 
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="w-full text-[10px] border border-slate-200 rounded-xl px-2 py-2 bg-slate-50 outline-none"
                  title="Tanggal Akhir"
                />
              </div>
            </div>
            
            {(filterDistrict !== 'all' || filterCategory !== 'all' || filterDateStart || filterDateEnd || searchQuery) && (
              <div className="mt-4 flex items-center gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter Aktif:</p>
                <button 
                  onClick={() => {
                    setFilterDistrict('all');
                    setFilterCategory('all');
                    setFilterDateStart('');
                    setFilterDateEnd('');
                    setSearchQuery('');
                  }}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline"
                >
                  Reset Semua
                </button>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nama Event</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lokasi</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Periode</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Kategori</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => {
                      const canEdit = session?.role === 'province' || session?.districtId === event.districtId;
                      
                      return (
                        <tr key={event.id} className={`hover:bg-slate-50 transition-colors ${!canEdit ? 'opacity-70' : ''}`}>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-[15px] flex items-center">
                                {event.title}
                                {getRoleBadge(event)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{event.districtName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm font-medium text-slate-600">{event.location}</td>
                          <td className="px-6 py-5 text-sm font-medium text-slate-600">
                             <div className="flex flex-col">
                               <span className="text-emerald-700 font-bold whitespace-nowrap">{new Date(event.startDate || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                               <span className="text-[10px] text-slate-400">s/d {new Date(event.endDate || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                             </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[10px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-bold uppercase tracking-wide">
                              {event.category}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                             {canEdit ? (
                               <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingEvent(event);
                                      setFormData({
                                        title: event.title,
                                        description: event.description,
                                        startDate: event.startDate,
                                        endDate: event.endDate,
                                        location: event.location,
                                        category: event.category,
                                        count: event.count,
                                        budget: event.budget,
                                        pic: event.pic || '',
                                        phone: event.phone || ''
                                      });
                                      setIsFormOpen(true);
                                    }}
                                    className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => setIsDeleting(event.id || null)}
                                    className="text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                               </div>
                             ) : (
                               <button 
                                onClick={() => {
                                  setEditingEvent(event);
                                  setFormData({
                                    title: event.title,
                                    description: event.description,
                                    startDate: event.startDate,
                                    endDate: event.endDate,
                                    location: event.location,
                                    category: event.category,
                                    count: event.count,
                                    budget: event.budget,
                                    pic: event.pic || '',
                                    phone: event.phone || ''
                                  });
                                  setIsFormOpen(true);
                                }}
                                className="text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                               >
                                 Detail
                               </button>
                             )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">Data tidak ditemukan</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
          
          <div className="mt-8 flex justify-between items-center text-xs text-slate-400 font-medium">
             <p>Menampilkan {activeView === 'calendar' ? events.length : filteredEvents.length} data event</p>
             <div className="flex flex-col items-end">
               <p className="hidden md:block">Sistem Informasi Pariwisata Sumatera Barat &copy; {new Date().getFullYear()}</p>
               <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-1 lg:hidden">Design by Minangkaos</p>
             </div>
          </div>
        </main>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!editingEvent || (session?.role === 'province' || session?.districtId === editingEvent.districtId)) {
                   setIsFormOpen(false);
                } else {
                   setIsFormOpen(false);
                }
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-xl text-slate-800 tracking-tight">
                  {editingEvent ? 
                    (session?.role === 'province' || session?.districtId === editingEvent.districtId ? 'Edit Event' : 'Detail Event') 
                    : 'Tambah Event Baru'}
                </h3>
                <button 
                  onClick={() => setIsFormOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <LogOut className="rotate-90" size={20} />
                </button>
              </div>

              <form onSubmit={handleUpsertEvent} className="p-8 space-y-6">
                {(editingEvent && session?.role !== 'province' && session?.districtId !== editingEvent.districtId) ? (
                   // Read-Only Detail Mode
                   <div className="space-y-4">
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Judul Event</p>
                       <p className="text-lg font-bold text-slate-800">{editingEvent.title}</p>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kategori</p>
                          <p className="text-sm font-medium">{editingEvent.category}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estimasi Anggaran</p>
                          <p className="text-sm font-bold text-emerald-700">Rp {editingEvent.budget?.toLocaleString('id-ID') || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Periode Event</p>
                          <p className="text-sm font-medium">
                            {new Date(editingEvent.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} - {new Date(editingEvent.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lokasi</p>
                       <p className="text-sm font-medium">{editingEvent.location}</p>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Penyelenggara</p>
                         <p className="text-sm font-medium">{editingEvent.pic || '-'}</p>
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">No. Telpon</p>
                         <p className="text-sm font-medium">{editingEvent.phone || '-'}</p>
                       </div>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Deskripsi</p>
                       <p className="text-sm text-slate-600 italic">"{editingEvent.description || 'Tidak ada deskripsi'}"</p>
                     </div>
                     <button 
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl mt-4"
                      >
                        Tutup
                      </button>
                   </div>
                ) : (
                  // Edit/Create Mode
                  <>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Judul Event</label>
                        <input 
                          required
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                          placeholder="Contoh: Festival Rendang"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all shadow-sm"
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Kategori</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-sm shadow-sm"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Tgl Mulai</label>
                        <input 
                          required
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Tgl Selesai</label>
                        <input 
                          required
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Estimasi Anggaran (Rp)</label>
                        <input 
                          required
                          type="number"
                          value={formData.budget ?? ''}
                          onChange={(e) => setFormData({...formData, budget: e.target.value === '' ? undefined : Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all shadow-sm font-semibold"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Lokasi Spesifik</label>
                        <input 
                          required
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          placeholder="Nama Tempat / Kecamatan"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Penyelenggara</label>
                        <input 
                          required
                          type="text"
                          value={formData.pic}
                          onChange={(e) => setFormData({...formData, pic: e.target.value})}
                          placeholder="Nama Penyelenggara"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm transition-all"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Nomor Telpon</label>
                        <input 
                          required
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          placeholder="Contoh: 0812..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm transition-all"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Estimasi Peserta / Satuan</label>
                        <input 
                          required
                          type="number"
                          value={formData.count ?? ''}
                          onChange={(e) => setFormData({...formData, count: e.target.value === '' ? undefined : Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm font-semibold"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-1">Deskripsi Singkat</label>
                        <textarea 
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                      <div className="flex gap-3">
                        <button 
                          type="button"
                          onClick={() => setIsFormOpen(false)}
                          className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                          Batal
                        </button>
                        <button 
                          type="submit"
                          className="flex-[2] py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          {editingEvent ? 'Simpan Perubahan' : 'Ajukan'}
                        </button>
                      </div>
                      {editingEvent && (
                        <button 
                          type="button"
                          onClick={() => {
                            setIsFormOpen(false);
                            setIsDeleting(editingEvent.id || null);
                          }}
                          className="w-full py-3 text-red-600 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} />
                          Hapus Event
                        </button>
                      )}
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsDeleting(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 border border-slate-100"
            >
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Event?</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                Data yang dihapus tidak dapat dikembalikan. Apakah Anda yakin ingin menghapus data ini dari sistem provinsi?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleDeleteEvent(isDeleting)}
                  className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components to keep code clean
function UserSessionIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

interface Holiday {
  holiday_date: string;
  holiday_name: string;
  is_national_holiday: boolean;
}

function CalendarView({ events }: { events: EventData[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const year = currentMonth.getFullYear();
        const res = await fetch(`/api/holidays?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setHolidays(data);
        } else {
          console.warn("Holiday fetch failed via proxy");
        }
      } catch (err) {
        console.error("Holiday Fetch Error:", err);
      }
    };
    fetchHolidays();
  }, [currentMonth.getFullYear()]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayEvents = (day: Date) => {
    return events.filter(e => {
      const eventStart = parseISO(e.startDate);
      const eventEnd = parseISO(e.endDate);
      return (isSameDay(day, eventStart) || (day >= eventStart && day <= eventEnd));
    });
  };

  const getDayHoliday = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return holidays.find(h => h.holiday_date === dateStr);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-800 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Pantau jadwal event pariwisata Sumatera Barat</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-600 shadow-sm hover:shadow-md"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            Bulan Ini
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-600 shadow-sm hover:shadow-md"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-slate-50/30 border-b border-slate-100">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 last:border-0">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day, i) => {
          const dayEvents = getDayEvents(day);
          const holiday = getDayHoliday(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);
          
          return (
            <div 
              key={day.toString()} 
              className={`min-h-[120px] p-2 border-r border-b border-slate-100 last:border-r-0 relative transition-colors ${!isCurrentMonth ? 'bg-slate-25 text-slate-300' : 'bg-white hover:bg-slate-50/30'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-lg ${isTodayDate ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200' : holiday ? 'text-red-500' : 'text-slate-500'}`}>
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" title={holiday.holiday_name}>
                    LIBUR
                  </span>
                )}
              </div>
              
              <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div 
                    key={event.id || idx}
                    className="text-[10px] p-1.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 font-bold truncate leading-tight shadow-sm"
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-slate-400 font-black px-1">
                    +{dayEvents.length - 3} EVENT LAINNYA
                  </div>
                )}
                {holiday && (
                  <div className="text-[9px] p-1.5 bg-red-50 text-red-700 rounded-md border border-red-100 font-bold leading-tight italic truncate">
                    {holiday.holiday_name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-600 rounded" />
          Event Pariwisata
        </div>
        <div className="flex items-center gap-2 text-red-500">
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded" />
          Libur/Cuti Bersama
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white border border-emerald-500 rounded ring-1 ring-emerald-500 ring-offset-2" />
          Hari Ini
        </div>
      </div>
    </div>
  );
}

