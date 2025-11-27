import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="shop-container py-16">
    <div className="glass-card p-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-night-400">Ошибка</p>
      <h1 className="text-5xl font-semibold text-night-900">404</h1>
      <p className="text-night-500">Страница не найдена</p>
      <Link to="/" className="secure-button mt-6 inline-flex">
        На главную
      </Link>
    </div>
  </div>
);

export default NotFoundPage;

