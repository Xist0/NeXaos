import { Component } from "react";
import logger from "../../services/logger";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logger.error("UI boundary caught error", { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="layout-shell" style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Что-то пошло не так</h1>
          <p>Мы уже знаем об ошибке и работаем над исправлением.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

