import { Navigate } from "react-router-dom";

export function DirectInvoices() {
  return <Navigate to="/quotes/new?direct=1" replace />;
}
