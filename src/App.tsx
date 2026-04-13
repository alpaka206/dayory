import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import YouTubePlaylistPlayer from "./components/YoutubePlaylistPlayer";
import { TRACKS } from "./constants/TRACKS";
import { EntriesProvider } from "./hooks/useEntries";
import BookmarkPage from "./pages/Bookmark";
import Home from "./pages/Home";
import "./styles/global.css";

function AppHeader() {
  const { pathname } = useLocation();
  const isFav = pathname.startsWith("/favorite");

  return (
    <header className="container masthead">
      <div className="appHeader">
        <div className="brandIntro reveal">
          <span className="eyebrow">문장 보관소</span>

          <div className="brandFrame">
            <div className="brandTitle">틈</div>

            <div className="brandCopy">
              <h1 className="pageTitle">
                {isFav
                  ? "저장한 문장과 기록을 다시 펼쳐보는 서가"
                  : "문장과 기록을 천천히 펼쳐보는 시간"}
              </h1>
              <p className="pageLead">
                {isFav
                  ? "좋아한 글만 차분하게 모아두고, 필요할 때 바로 다시 읽을 수 있습니다."
                  : "짧은 문장부터 긴 기록까지, 음악과 함께 한 장씩 넘겨보세요."}
              </p>
            </div>
          </div>
        </div>

        <div className="mastheadPanel reveal">
          <nav className="floatingNav" aria-label="페이지 탐색">
            <NavLink
              to="/"
              end
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
