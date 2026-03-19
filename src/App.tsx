import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import BookmarkPage from "./pages/Bookmark";
import { EntriesProvider } from "./hooks/useEntries";
import "./styles/global.css";
import YouTubePlaylistPlayer from "./components/YoutubePlaylistPlayer";
import { TRACKS } from "./constants/TRACKS";

function AppHeader() {
  const { pathname } = useLocation();
  const isFav = pathname.startsWith("/favorite");

  return (
    <header className="container headerCompact">
      <div className="headerLeft">
        <div className="headerTitle">{isFav ? "저장함" : "다이어리"}</div>
        <div className="headerSub">
          {isFav ? "저장한 문장과 기록 모아보기" : "문장과 기록을 천천히 읽기"}
        </div>
      </div>

      <nav className="headerNav">
        <NavLink
          to="/"
          className={({ isActive }) => `chip ${isActive ? "on" : ""}`}
        >
          둘러보기
        </NavLink>
        <NavLink
          to="/favorite"
          className={({ isActive }) => `chip ${isActive ? "on" : ""}`}
        >
          저장함
        </NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EntriesProvider>
        <div className="glow" />

        <AppHeader />

        <div className="container" style={{ paddingBottom: 14 }}>
          <YouTubePlaylistPlayer tracks={TRACKS} />
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorite" element={<BookmarkPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </EntriesProvider>
    </BrowserRouter>
  );
}
