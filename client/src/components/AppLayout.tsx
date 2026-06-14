import { Toaster } from "../components/ui/sonner";
import { Sun, Moon, LogOut, Settings, BookOpen, Inbox } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "./theme-provider";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { postHeartbeat } from "../stats/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  usePendingFriends,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
} from "../stats/hooks";

function InboxPopover() {
  const { data: pending } = usePendingFriends();
  const acceptReq = useAcceptFriendRequest();
  const declineReq = useDeclineFriendRequest();

  const incoming = pending?.incoming ?? [];
  const count = incoming.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="hover:bg-accent hover:text-accent-foreground relative rounded-md p-2 transition-colors" aria-label="Inbox">
          <Inbox className="size-4" />
          {count > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[0.55rem] font-bold leading-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2">
        <p className="text-muted-foreground px-1 pb-1 text-[0.65rem] font-medium uppercase tracking-wider">
          Inbox
        </p>
        {incoming.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-center text-xs">
            No pending requests
          </p>
        ) : (
          <div className="space-y-1">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted"
              >
                <span className="font-medium">{req.displayName}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => acceptReq.mutate(req.id)}
                    className="hover:bg-primary/15 text-primary rounded-sm p-1 transition-colors"
                    aria-label="Accept"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button
                    onClick={() => declineReq.mutate(req.id)}
                    className="hover:bg-destructive/15 text-destructive rounded-sm p-1 transition-colors"
                    aria-label="Decline"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:bg-accent flex size-7 items-center justify-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground transition-colors">
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-40">
        <DropdownMenuItem onClick={() => navigate("/how-to")}>
          <BookOpen className="mr-2 size-3.5" />
          Tutorial
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="mr-2 size-3.5" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 size-3.5" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!user) return;
    postHeartbeat();
    heartbeatRef.current = setInterval(postHeartbeat, 60_000);
    return () => clearInterval(heartbeatRef.current);
  }, [user]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const icon = resolvedTheme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-background flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <a href="/" className="text-foreground text-lg font-semibold tracking-tight hover:underline">
          Gin 13
        </a>
        <div className="flex items-center gap-1">
          {user && <InboxPopover />}
          <button
            onClick={toggleTheme}
            className="hover:bg-accent hover:text-accent-foreground mr-1 rounded-md p-2 transition-colors"
            aria-label="Toggle theme"
          >
            {icon}
          </button>
          {user ? (
            <UserMenu />
          ) : (
            !isAuthPage && (
              <Button variant="ghost" size="sm" asChild>
                <a href="/login">Login</a>
              </Button>
            )
          )}
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
