import { Navigate } from "react-router-dom";
import { Buildings } from "@medusajs/icons";
import type { RouteConfig } from "@mercurjs/dashboard-sdk";

// Nav-only parent for the Operations section (Deliveries, Customer Support).
// ponytail: redirect to the first child instead of a bespoke landing page.
export const config: RouteConfig = {
  label: "Operations",
  icon: Buildings,
  rank: 20,
};

const OperationsSection = () => <Navigate to="/deliveries" replace />;

export default OperationsSection;
