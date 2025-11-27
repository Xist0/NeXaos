import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="layout-content">
    <div className="glass-panel" style={{ textAlign: "center" }}>
      <h1>404</h1>
      <p>Страница не найдена</p>
      <Link to="/" className="secure-button">
        На главную
      </Link>
    </div>
  </div>
);

export default NotFoundPage;

