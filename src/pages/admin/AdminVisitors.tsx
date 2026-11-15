import React, { useEffect, useState, useMemo } from "react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Eye,
  Smartphone,
  Laptop,
  Tablet,
  Share2,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Loader2,
  Clock,
  Sparkles,
  TrendingUp,
  Globe,
  ArrowRight,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

type CalendarDayData = {
  count: number;
  unique: number;
  opens?: number;
};

type RecentVisit = {
  time: string;
  device: string;
  referrer: string;
  path: string;
  visitor_id: string;
};

type SelectedDayStats = {
  date: string;
  total_visits: number;
  unique_count: number;
  unique_visitors?: string[];
  hourly: number[];
  sources: Record<string, number>;
  devices: Record<string, number>;
  recent_visits: RecentVisit[];
};

export const AdminVisitors: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  // Current Ghana date: YYYY-MM-DD
  const ghanaToday = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(ghanaToday);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData>>({});
  const [selectedStats, setSelectedStats] = useState<SelectedDayStats | null>(null);
  const [summary, setSummary] = useState<{
    today: number;
    yesterday: number;
    this_month: number;
    selected_date_total: number;
  }>({
    today: 0,
    yesterday: 0,
    this_month: 0,
    selected_date_total: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Month string prefix, e.g. "2026-10"
  const monthPrefix = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [currentMonth]);

  const loadData = async (targetDate: string, isSilent = false, force = false) => {
    if (!force) {
      const cached = getCacheMeta<{ calendarData: any; selectedStats: any; summary: any }>(`admin_visitors_${targetDate}`);
      if (cached.exists && cached.data) {
        if (cached.data.calendarData) setCalendarData(cached.data.calendarData);
        if (cached.data.selectedStats) setSelectedStats(cached.data.selectedStats);
        if (cached.data.summary) setSummary(cached.data.summary);
        setLoading(false);
        setRefreshing(false);
        if (!cached.isStale) return;
      }
    }

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    let loaded = false;

    // 1. Try invokeApiFunction
    try {
      const res: any = await invokeApiFunction("admin-visitors", {
        body: { date: targetDate },
      });

      if (res?.data && res.data.ok) {
        setCalendarData(res.data.calendarData || {});
        setSelectedStats(res.data.selectedStats || null);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        setCache(`admin_visitors_${targetDate}`, {
          calendarData: res.data.calendarData,
          selectedStats: res.data.selectedStats,
          summary: res.data.summary,
        }, 2 * 60 * 1000);
        loaded = true;
      }
    } catch (err) {
      console.warn("Could not load visitor stats via invokeApiFunction:", err);
    }

    // 2. Fallback: Direct query to `settings` table
    if (!loaded) {
      try {
        const { data: rows } = await supabase
          .from("settings")
          .select("key, value")
          .ilike("key", "visitor_log_%");

        const cal: Record<string, CalendarDayData> = {};
        let dayStats: SelectedDayStats | null = null;
        let todayCount = 0;
        let yestCount = 0;
        let monthCount = 0;

        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yestStr = yDate.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });

        for (const row of rows || []) {
          try {
            const parsed = JSON.parse(row.value);
            const d = parsed.date;
            if (!d) continue;
            const opens = parsed.total_visits || 0;
            const unique = Array.isArray(parsed.unique_visitors) ? parsed.unique_visitors.length : (opens > 0 ? 1 : 0);
            cal[d] = { count: unique, unique, opens };

            if (d.startsWith(monthPrefix)) monthCount += unique;
            if (d === ghanaToday) todayCount = unique;
            if (d === yestStr) yestCount = unique;

            if (d === targetDate) {
              dayStats = {
                date: targetDate,
                total_visits: opens,
                unique_count: unique,
                hourly: Array.isArray(parsed.hourly) ? parsed.hourly : Array(24).fill(0),
                sources: parsed.sources || {},
                devices: parsed.devices || {},
                recent_visits: parsed.recent_visits || [],
              };
            }
          } catch (_) {}
        }

        setCalendarData(cal);
        setSummary({
          today: todayCount,
          yesterday: yestCount,
          this_month: monthCount,
          selected_date_total: dayStats ? dayStats.unique_count : 0,
        });

        if (dayStats) {
          setSelectedStats(dayStats);
        } else {
          setSelectedStats({
            date: targetDate,
            total_visits: 0,
            unique_count: 0,
            hourly: Array(24).fill(0),
            sources: {},
            devices: {},
            recent_visits: [],
          });
        }
      } catch (fbErr) {
        console.warn("Direct query fallback failed:", fbErr);
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "Admin · Site Visitors Calendar";
    loadData(selectedDate);
    // Smart interval polls every 60 seconds and auto-pauses when tab is hidden
    const stopPolling = createSmartInterval(() => {
      loadData(selectedDate, true);
    }, 1800000);
    return () => stopPolling();
  }, [selectedDate, monthPrefix]);

  const changeMonth = (delta: number) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      return next;
    });
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(ghanaToday);
  };

  // Generate calendar days for the current displayed month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      stats?: CalendarDayData;
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === ghanaToday,
        isSelected: dateStr === selectedDate,
        stats: calendarData[dateStr],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === ghanaToday,
        isSelected: dateStr === selectedDate,
        stats: calendarData[dateStr],
      });
    }

    // Next month padding days to fill 42 cells (6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextM = month + 2 > 12 ? 1 : month + 2;
      const nextY = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === ghanaToday,
        isSelected: dateStr === selectedDate,
        stats: calendarData[dateStr],
      });
    }

    return days;
  }, [currentMonth, selectedDate, calendarData, ghanaToday]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentMonth]);

  const selectedDateReadable = useMemo(() => {
    if (!selectedDate) return "";
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (!y || !m || !d) return selectedDate;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [selectedDate]);

  // Transform hourly array to recharts format
  const hourlyChartData = useMemo(() => {
    const hours = selectedStats?.hourly || Array(24).fill(0);
    return hours.map((count, hour) => {
      const displayHour = `${String(hour).padStart(2, "0")}:00`;
      return {
        hour: displayHour,
        visitors: count,
      };
    });
  }, [selectedStats]);

  // Top source computation
  const sourceList = useMemo(() => {
    if (!selectedStats?.sources) return [];
    const entries = Object.entries(selectedStats.sources);
    entries.sort((a, b) => b[1] - a[1]);
    const total = selectedStats.total_visits || 1;
    return entries.map(([src, count]) => ({
      source: src,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [selectedStats]);

  const deviceList = useMemo(() => {
    if (!selectedStats?.devices) return [];
    const entries = Object.entries(selectedStats.devices);
    entries.sort((a, b) => b[1] - a[1]);
    const total = selectedStats.total_visits || 1;
    return entries.map(([dev, count]) => ({
      device: dev,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [selectedStats]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      {!embedded && (
        <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider mb-2">
                <Globe className="size-3.5" /> Site Visitors & Link Opens Tracker
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">
                Visitor Calendar
              </h1>
              <p className="text-sm md:text-base text-white/90 mt-1 max-w-xl">
                Select any date to see how many people opened your shop link, their link source (WhatsApp, social media), and live activity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadData(selectedDate)}
                disabled={loading || refreshing}
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md font-bold"
              >
                <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Updating…" : "Refresh"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={jumpToToday}
                className="bg-white text-indigo-900 hover:bg-white/95 font-black shadow-md"
              >
                Today
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-card to-background shadow-md">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Today's Devices</span>
            <Users className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-foreground">
            {summary.today.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unique customer devices today</p>
        </Card>

        <Card className="p-4 border-2 border-sky-500/30 bg-gradient-to-br from-sky-950/40 via-card to-background shadow-md">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Yesterday</span>
            <Users className="size-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-foreground">
            {summary.yesterday.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unique devices yesterday</p>
        </Card>

        <Card className="p-4 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card to-background shadow-md">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>This Month</span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-foreground">
            {summary.this_month.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Unique devices in {monthLabel}</p>
        </Card>

        <Card className="p-4 border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-card to-background shadow-md">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Selected Date</span>
            <CalendarIcon className="size-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-amber-400">
            {((selectedStats?.unique_count ?? selectedStats?.total_visits) || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {selectedStats?.total_visits ? `${selectedStats.total_visits} link opens` : selectedDate}
          </p>
        </Card>
      </div>

      {/* Main Two-Column Layout: Calendar (Left/Top) + Day Breakdown (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendar Section (lg:col-span-7) */}
        <Card className="lg:col-span-7 p-4 md:p-6 border-2 border-border/80 shadow-xl rounded-2xl bg-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <CalendarIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-foreground">
                  {monthLabel}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Click any day on the calendar to inspect visitor details
                </p>
              </div>
            </div>

            {/* Controls: Month Nav + Quick Date Jump */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeMonth(-1)}
                className="size-8 rounded-lg"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={jumpToToday}
                className="text-xs h-8 px-2.5 font-bold"
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeMonth(1)}
                className="size-8 rounded-lg"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </Button>

              {/* Direct Native Date Picker */}
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      const [y, m] = e.target.value.split("-").map(Number);
                      if (y && m) {
                        setCurrentMonth(new Date(y, m - 1, 1));
                      }
                    }
                  }}
                  className="w-9 h-8 opacity-0 absolute inset-0 cursor-pointer"
                  title="Pick exact date"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg bg-accent/20 border-accent/40 text-accent hover:bg-accent/30"
                  title="Pick any date from calendar picker"
                >
                  <CalendarIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Date Shortcuts */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold mr-1">Quick Select:</span>
            <Button
              variant={selectedDate === ghanaToday ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => {
                setSelectedDate(ghanaToday);
                jumpToToday();
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                const yStr = y.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
                setSelectedDate(yStr);
                setCurrentMonth(new Date(y.getFullYear(), y.getMonth(), 1));
              }}
            >
              Yesterday
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                const dStr = d.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
                setSelectedDate(dStr);
                setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            >
              7 Days Ago
            </Button>
          </div>

          {/* Day Names Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider py-1">
            <span className="text-rose-400">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-indigo-400">Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((item, idx) => {
              const visits = item.stats?.count || 0;
              const unique = item.stats?.unique || 0;

              let heatBg = "hover:bg-muted/80 bg-card/60";
              if (visits > 0) {
                if (visits >= 50) {
                  heatBg = "bg-emerald-500/25 border-emerald-500/60 text-emerald-300 font-bold hover:bg-emerald-500/35";
                } else if (visits >= 20) {
                  heatBg = "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold hover:bg-indigo-500/30";
                } else {
                  heatBg = "bg-sky-500/15 border-sky-500/40 text-sky-300 font-medium hover:bg-sky-500/25";
                }
              }

              const isDimmed = !item.isCurrentMonth;

              return (
                <button
                  key={`${item.dateStr}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedDate(item.dateStr);
                    if (!item.isCurrentMonth) {
                      const [y, m] = item.dateStr.split("-").map(Number);
                      if (y && m) setCurrentMonth(new Date(y, m - 1, 1));
                    }
                  }}
                  className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2 min-h-[58px] sm:min-h-[72px] rounded-xl border transition-all text-left group ${
                    item.isSelected
                      ? "ring-2 ring-amber-400 bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] z-10 scale-[1.03]"
                      : item.isToday
                      ? "border-primary font-bold shadow-sm"
                      : "border-border/50"
                  } ${heatBg} ${isDimmed ? "opacity-35" : "opacity-100"}`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-black rounded-full size-6 flex items-center justify-center ${
                        item.isSelected
                          ? "bg-amber-400 text-amber-950"
                          : item.isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.dayNumber}
                    </span>

                    {item.isToday && !item.isSelected && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-primary/20 text-primary uppercase font-bold tracking-tighter hidden sm:inline">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Visitor Count Indicator */}
                  <div className="w-full mt-auto text-center sm:text-right">
                    {visits > 0 ? (
                      <div className="inline-flex flex-col items-center sm:items-end w-full">
                        <span className="text-[11px] sm:text-xs font-black text-foreground tracking-tight">
                          {visits}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter hidden sm:block">
                          {visits === 1 ? "1 device" : `${visits} devices`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30 font-medium">
                        —
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-400" /> High Traffic (50+ devices)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-indigo-400" /> Active (20–49 devices)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-sky-400" /> Moderate (1–19 devices)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="size-2.5 rounded-full border-2 border-amber-400 bg-amber-400/40" /> Selected Date
            </div>
          </div>
        </Card>

        {/* Selected Date Details Panel (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 md:p-6 border-2 border-amber-500/40 bg-gradient-to-br from-card via-card to-amber-950/20 shadow-xl rounded-2xl space-y-5">
            {/* Header with selected date */}
            <div className="border-b pb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-500/30">
                <CalendarIcon className="size-3.5" /> Date Report
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground">
                {selectedDateReadable}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detailed link open analytics and traffic attribution for {selectedDate}
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-background/80 border border-emerald-500/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold uppercase">
                  <Users className="size-3.5 text-emerald-400" /> Unique Devices
                </div>
                <div className="mt-1 text-2xl font-black text-emerald-400">
                  {((selectedStats?.unique_count ?? selectedStats?.total_visits) || 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground">Distinct customer devices</p>
              </div>

              <div className="p-3.5 rounded-xl bg-background/80 border border-border/60">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold uppercase">
                  <Eye className="size-3.5 text-indigo-400" /> Total Link Opens
                </div>
                <div className="mt-1 text-2xl font-black text-foreground">
                  {(selectedStats?.total_visits || 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground">All clicks & page reloads</p>
              </div>
            </div>

            {/* Hourly Link Open Trend Chart */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-sky-400" /> 24-Hour Traffic Distribution
                </span>
                <span className="text-[11px] text-muted-foreground">Ghana Time (GMT)</span>
              </div>

              {selectedStats?.total_visits === 0 ? (
                <div className="py-8 text-center rounded-xl bg-muted/30 border border-dashed text-xs text-muted-foreground">
                  No visitors recorded on this date yet.
                </div>
              ) : (
                <div className="h-36 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={3} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="visitors" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {hourlyChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.visitors > 0 ? "#6366f1" : "hsl(var(--muted))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Traffic Sources Breakdown */}
            <div className="space-y-3 pt-2 border-t">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Share2 className="size-3.5 text-indigo-400" /> Link Sources (Where they came from)
              </span>

              {sourceList.length === 0 ? (
                <p className="text-xs text-muted-foreground">No source data recorded for this date.</p>
              ) : (
                <div className="space-y-2">
                  {sourceList.map((item) => (
                    <div key={item.source} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1.5 truncate">
                          {item.source.toLowerCase().includes("whatsapp") ? (
                            <MessageCircle className="size-3.5 text-emerald-400 shrink-0" />
                          ) : item.source.toLowerCase().includes("face") || item.source.toLowerCase().includes("fb") ? (
                            <Globe className="size-3.5 text-blue-400 shrink-0" />
                          ) : (
                            <ExternalLink className="size-3.5 text-sky-400 shrink-0" />
                          )}
                          <span className="font-semibold text-foreground">{item.source}</span>
                        </span>
                        <span className="font-bold text-foreground">
                          {item.count} <span className="text-[10px] text-muted-foreground font-normal">({item.pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full"
                          style={{ width: `${Math.max(item.pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Devices Breakdown */}
            <div className="space-y-3 pt-2 border-t">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-emerald-400" /> Customer Devices
              </span>

              {deviceList.length === 0 ? (
                <p className="text-xs text-muted-foreground">No device data for this date.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {deviceList.map((dev) => (
                    <div
                      key={dev.device}
                      className="p-2.5 rounded-xl bg-background/80 border border-border/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {dev.device.toLowerCase().includes("mobile") ? (
                          <Smartphone className="size-4 text-emerald-400" />
                        ) : dev.device.toLowerCase().includes("tab") ? (
                          <Tablet className="size-4 text-indigo-400" />
                        ) : (
                          <Laptop className="size-4 text-sky-400" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-foreground">{dev.device}</p>
                          <p className="text-[10px] text-muted-foreground">{dev.pct}% share</p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-foreground">{dev.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Visit Activity Stream for selected date */}
            {selectedStats && selectedStats.recent_visits && selectedStats.recent_visits.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-400" /> Recent Visits Stream
                </span>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedStats.recent_visits.slice(0, 15).map((v, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-background/60 border border-border/40 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                          {v.time}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {v.referrer || "Direct"}
                        </span>
                        <span className="text-muted-foreground text-[10px] truncate">
                          {v.path}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                        {v.device}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminVisitors;
