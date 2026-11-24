import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";

export default function NotFoundPage() {
  return (
    <div className="narrow">
      <EmptyState
        icon="lost"
        title="No encontramos esta página"
        action={<Link className="btn btn--primary" to="/">Ir al catálogo</Link>}
      >
        El enlace puede estar mal escrito o la página ya no existe.
      </EmptyState>
    </div>
  );
}
