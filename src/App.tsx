import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import YouTubePlaylistPlayer from "./components/YoutubePlaylistPlayer";
import { TRACKS } from "./constants/TRACKS";
import { EntriesProvider } from "./hooks/useEntries";
import BookmarkPage from "./pages/Bookmark";
import Home from "./pages/Home";
import "./styles/global.css";

function AppHeader() {
  return (
    <header className="container masthead">
      <div className="appHeader">
        <div className="brandIntro reveal">
          <div className="brandFrame">
            <div className="brandTitle">버팀목</div>
          </div>
        </div>

        <div className="mastheadPanel reveal">
          <nav className="floatingNav" aria-label="페이지 탐색">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `navItem ${isActive ? "on" : ""}`}
            >
              둘러보기
            </NavLink>
            <NavLink
              to="/favorite"
              className={({ isActive }) => `navItem ${isActive ? "on" : ""}`}
            >
              저장함
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <>
      <div className="glow" />
      <AppHeader />

      <main className="appMain">
        <div className="container playerDock">
          <YouTubePlaylistPlayer tracks={TRACKS} />
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorite" element={<BookmarkPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EntriesProvider>
        <AppLayout />
      </EntriesProvider>
    </BrowserRouter>
  );
}
