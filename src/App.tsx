import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import Favorites from "./pages/Bookmark";
import "./styles/global.css";
import YoutubePlaylistPlayer from "./components/YoutubePlaylistPlayer";
import { TRACKS } from "./constants/TRACKS";

function AppHeader() {
  const { pathname } = useLocation();
  const isFav = pathname.startsWith("/favorite");

  return (
    <header className="container headerCompact">
      <div className="headerLeft">
        <div className="headerTitle">{isFav ? "Bookmark" : "다이어리"}</div>
        <div className="headerSub">
          {isFav ? "저장한 글 모아보기" : "좋은 글귀 및 생각 정리"}
        </div>
      </div>

      <nav className="headerNav">
        <NavLink
          to="/"
          className={({ isActive }) => `chip ${isActive ? "on" : ""}`}
        >
          Home
        </NavLink>
        <NavLink
          to="/favorite"
          className={({ isActive }) => `chip ${isActive ? "on" : ""}`}
        >
          Bookmark
        </NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="glow" />

      <AppHeader />

      <div className="container" style={{ paddingBottom: 14 }}>
        <YoutubePlaylistPlayer tracks={TRACKS} />
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/favorite" element={<Favorites />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
