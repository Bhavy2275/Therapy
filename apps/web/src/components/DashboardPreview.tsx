import React from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  CheckCircle2,
  Plus,
  MoreVertical,
  Home,
  Video,
  Phone,
  MessageSquare,
  Calendar,
  Users,
  ShieldCheck,
  Settings,
  Sparkles,
} from 'lucide-react';

export default function DashboardPreview() {
  return (
    <div
      className="rounded-2xl overflow-hidden p-2 md:p-3 shadow-2xl backdrop-blur-md"
      style={{
        background: 'rgba(255, 255, 255, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: 'var(--shadow-dashboard)',
      }}
    >
      <div className="bg-white rounded-xl border border-border/80 overflow-hidden text-[11px] select-none pointer-events-none flex flex-col shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white/95">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-accent text-accent-foreground flex items-center justify-center font-bold text-[11px]">
              J
            </div>
            <span className="font-semibold text-foreground tracking-tight">Jarwis Care</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2 bg-secondary/80 border border-border/80 rounded-md px-2.5 py-1 text-muted-foreground w-64 justify-between">
            <div className="flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              <span>Search therapists, specialties...</span>
            </div>
            <kbd className="text-[9px] bg-background border border-border rounded px-1 text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="bg-accent text-accent-foreground font-medium rounded-full px-3 py-1 text-[10px] flex items-center gap-1 shadow-sm"
            >
              <Sparkles className="w-3 h-3" />
              <span>Instant Connect</span>
            </button>
            <Bell className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-[9px]">
              JH
            </div>
          </div>
        </div>

        {/* Body (Sidebar + Main Content) */}
        <div className="flex flex-1 min-h-[360px]">
          {/* Sidebar */}
          <aside className="w-36 md:w-44 border-r border-border p-2.5 flex flex-col gap-3 bg-secondary/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-secondary text-foreground font-medium">
                <Home className="w-3 h-3 text-accent" />
                <span>Overview</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Video className="w-3 h-3" />
                  <span>Live Sessions</span>
                </div>
                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-full text-[9px] font-medium">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>Find Therapists</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>Schedule</span>
                </div>
                <ChevronDown className="w-2.5 h-2.5" />
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span>Private Chat</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
                <ShieldCheck className="w-3 h-3" />
                <span>Verification</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-1">
                Care Tools
              </div>
              <div className="space-y-0.5 text-muted-foreground">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Phone className="w-3 h-3" />
                  <span>Audio Sessions</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1">
                  <Calendar className="w-3 h-3" />
                  <span>Follow-ups</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1">
                  <Settings className="w-3 h-3" />
                  <span>Preferences</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-4 bg-secondary/30 flex flex-col gap-3.5 overflow-hidden">
            {/* Greeting */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Welcome to Jarwis Care</h3>
                <p className="text-[10px] text-muted-foreground">You are 1 click away from compassionate support</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>142 Therapists Online</span>
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                className="bg-accent text-accent-foreground font-medium rounded-full px-3 py-1 text-[10px]"
              >
                Start Live Matching
              </button>
              {['Book Video', 'Audio Only', 'Chat Consultation', 'View Schedules', 'Crisis Support'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className="bg-background border border-border text-foreground hover:bg-secondary font-medium rounded-full px-2.5 py-1 text-[10px]"
                >
                  {btn}
                </button>
              ))}
              <span className="text-muted-foreground text-[10px] ml-1.5 cursor-default">+ More</span>
            </div>

            {/* Two equal-width cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Completed Sessions card */}
              <div className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[10px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Sessions Completed</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-foreground tracking-tight">
                    10,480<span className="text-xs text-muted-foreground font-normal"> sessions</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 text-[10px]">
                    <span className="text-muted-foreground">30-Day Growth</span>
                    <span className="text-emerald-600 font-medium">+1,240 clients</span>
                    <span className="text-accent font-medium">★ 4.9 / 5 Satisfaction</span>
                  </div>
                </div>

                {/* Smooth cubic Bézier area chart */}
                <div className="h-20 w-full mt-2 relative">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 400 80"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="therapyChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 65 C 60 55, 110 70, 160 40 C 210 15, 270 48, 330 22 C 365 7, 385 18, 400 12 L 400 80 L 0 80 Z"
                      fill="url(#therapyChartGradient)"
                    />
                    <path
                      d="M 0 65 C 60 55, 110 70, 160 40 C 210 15, 270 48, 330 22 C 365 7, 385 18, 400 12"
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth="1.75"
                    />
                  </svg>
                </div>
              </div>

              {/* Verified Therapists Online card */}
              <div className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <span className="font-semibold text-foreground text-xs">Verified Practitioners</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Plus className="w-3.5 h-3.5 cursor-default" />
                    <MoreVertical className="w-3.5 h-3.5 cursor-default" />
                  </div>
                </div>

                <div className="flex flex-col justify-around flex-1 py-1">
                  <div className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <div className="font-medium text-foreground">Dr. Ananya Sharma</div>
                      <div className="text-[9px] text-muted-foreground">Clinical Psychologist • Licensed</div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-medium">
                      Available Now
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <div className="font-medium text-foreground">Michael Chen, LPC</div>
                      <div className="text-[9px] text-muted-foreground">CBT & Anxiety Specialist</div>
                    </div>
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-medium">
                      In Session
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <div className="font-medium text-foreground">Dr. Priya Patel</div>
                      <div className="text-[9px] text-muted-foreground">Psychiatrist & Counselor</div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-medium">
                      Available Now
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Consultations table */}
            <div className="bg-background border border-border rounded-xl p-3 shadow-sm">
              <div className="font-semibold text-foreground text-xs mb-2">Recent Sessions</div>
              <div className="w-full">
                <div className="grid grid-cols-4 text-[10px] text-muted-foreground font-medium pb-1.5 border-b border-border">
                  <div>Time</div>
                  <div>Therapist</div>
                  <div>Format</div>
                  <div className="text-right">Status</div>
                </div>
                <div className="divide-y divide-border/60">
                  <div className="grid grid-cols-4 py-1.5 text-[10px] items-center">
                    <div className="text-muted-foreground">Just now</div>
                    <div className="font-medium text-foreground">Dr. Ananya Sharma</div>
                    <div className="text-foreground">Live Video</div>
                    <div className="text-right">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full px-2 py-0.5 text-[9px] font-medium">
                        Matched
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 py-1.5 text-[10px] items-center">
                    <div className="text-muted-foreground">Today 2:00 PM</div>
                    <div className="font-medium text-foreground">Michael Chen</div>
                    <div className="text-foreground">Voice Call</div>
                    <div className="text-right">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full px-2 py-0.5 text-[9px] font-medium">
                        Completed
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 py-1.5 text-[10px] items-center">
                    <div className="text-muted-foreground">Tomorrow 10 AM</div>
                    <div className="font-medium text-foreground">Dr. Priya Patel</div>
                    <div className="text-foreground">Scheduled Video</div>
                    <div className="text-right">
                      <span className="bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full px-2 py-0.5 text-[9px] font-medium">
                        Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
