import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Favorites from "./pages/Bookmark";
import "./styles/global.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="glow" />

      <header className="container" style={{ paddingBottom: 10 }}>
        <nav className="row" style={{ justifyContent: "flex-end" }}>
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

      <Routes>
        {/* 정상 라우트 */}
        <Route path="/" element={<Home />} />
        <Route path="/favorite" element={<Favorites />} />

        {/* 존재하지 않는 모든 경로 → root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
