import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider, useApp } from "./context";
import { Shell, roleHome } from "./components/Shell";
import { QuoteEditor, QuoteDetail, Quotes } from "./pages/Quotes";
import { SalesSchedule } from "./pages/SalesSchedule";
import {
  Finance,
  InvoiceDetail,
  Invoices,
  Submissions,
  Handoff,
  Orders,
  OrderDetail,
} from "./pages/Office";
import { Customers, Services, Performance } from "./pages/Resources";
import { Contractors } from "./pages/Contractors";
import { Suppliers } from "./pages/Suppliers";
import { ProductStyles } from "./pages/ProductStyles";
import {
  MunicipalOrderDetail,
  MunicipalOrders,
} from "./pages/MunicipalOrders";
import { Documents } from "./pages/Documents";
import { UserProfile, Users } from "./pages/Users";
import { DesignUsersPreview } from "./pages/DesignUsersPreview";
import { AccountingDashboard } from "./pages/AccountingDashboard";
import { BusinessOrders } from "./pages/BusinessOrders";
import { CustomWorkRequests } from "./pages/CustomWorkRequests";
import {
  CancellationCaseDetail,
  CancellationCases,
} from "./pages/CancellationCases";
import { Button, Empty } from "./components/ui";
import "./styles.css";
function Home() {
  const { actor } = useApp();
  return <Navigate replace to={roleHome(actor.role)} />;
}
function Guard({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { actor } = useApp();
  return roles.includes(actor.role) ? (
    children
  ) : (
    <Navigate replace to={roleHome(actor.role)} />
  );
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <Empty
          title="原型遇到問題，資料未被重置"
          description={this.state.error}
          action={
            <Button onClick={() => location.assign("/")}>返回入口</Button>
          }
        />
      </div>
    ) : (
      this.props.children
    );
  }
}
const sales = ["sales", "head", "supervisor"];
ReactDOM.createRoot(document.getElementById("root")!).render(
  <Boundary>
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/design/users"
            element={
              <Guard roles={["admin"]}>
                <DesignUsersPreview />
              </Guard>
            }
          />
          <Route path="/documents/:kind/:id" element={<Documents />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/quotes"
              element={
                <Guard roles={[...sales, "admin", "admin_staff", "finance"]}>
                  <Quotes />
                </Guard>
              }
            />
            <Route
              path="/quotes/new"
              element={
                <Guard roles={sales}>
                  <QuoteEditor />
                </Guard>
              }
            />
            <Route
              path="/quotes/:id/edit"
              element={
                <Guard roles={[...sales, "clerk", "finance_supervisor", "admin", "admin_staff"]}>
                  <QuoteEditor />
                </Guard>
              }
            />
            <Route
              path="/quotes/:id"
              element={
                <Guard roles={[...sales, "admin", "admin_staff", "finance"]}>
                  <QuoteDetail />
                </Guard>
              }
            />
            <Route
              path="/finance"
              element={
                <Guard roles={["finance"]}>
                  <Finance />
                </Guard>
              }
            />
            <Route
              path="/accounting-dashboard"
              element={
                <Guard roles={["finance_supervisor", "admin"]}>
                  <AccountingDashboard />
                </Guard>
              }
            />
            <Route
              path="/business-orders"
              element={
                <Guard roles={["finance_supervisor", "admin"]}>
                  <BusinessOrders />
                </Guard>
              }
            />
            <Route
              path="/cancellation-cases"
              element={
                <Guard
                  roles={[
                    "clerk",
                    "finance",
                    "finance_supervisor",
                    "admin",
                  ]}
                >
                  <CancellationCases />
                </Guard>
              }
            />
            <Route
              path="/cancellation-cases/:id"
              element={
                <Guard
                  roles={[
                    "clerk",
                    "finance",
                    "finance_supervisor",
                    "admin",
                  ]}
                >
                  <CancellationCaseDetail />
                </Guard>
              }
            />
            <Route
              path="/custom-work-requests"
              element={
                <Guard roles={["cs_supervisor", "admin"]}>
                  <CustomWorkRequests />
                </Guard>
              }
            />
            <Route
              path="/submissions"
              element={
                <Guard roles={["clerk", "finance_supervisor", "admin", "admin_staff"]}>
                  <Submissions />
                </Guard>
              }
            />
            <Route
              path="/invoices"
              element={
                <Guard roles={["clerk", "finance", "finance_supervisor", "admin", "admin_staff"]}>
                  <Invoices />
                </Guard>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <Guard roles={["clerk", "finance", "finance_supervisor", "admin", "admin_staff"]}>
                  <InvoiceDetail />
                </Guard>
              }
            />
            <Route
              path="/handoff"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "admin_staff"]}>
                  <Handoff />
                </Guard>
              }
            />
            <Route
              path="/orders"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "admin_staff", "finance"]}>
                  <Orders />
                </Guard>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "admin_staff", "finance"]}>
                  <OrderDetail />
                </Guard>
              }
            />
            <Route
              path="/contractors"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "admin_staff"]}>
                  <Contractors />
                </Guard>
              }
            />
            <Route
              path="/suppliers"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "admin_staff"]}>
                  <Suppliers />
                </Guard>
              }
            />
            <Route
              path="/product-styles"
              element={
                <Guard roles={[...sales, "admin", "admin_staff"]}>
                  <ProductStyles />
                </Guard>
              }
            />
            <Route
              path="/municipal-orders"
              element={
                <Guard roles={["clerk", "finance_supervisor", "admin", "admin_staff"]}>
                  <MunicipalOrders />
                </Guard>
              }
            />
            <Route
              path="/municipal-orders/:id"
              element={
                <Guard roles={["clerk", "finance_supervisor", "admin", "admin_staff"]}>
                  <MunicipalOrderDetail />
                </Guard>
              }
            />
            <Route
              path="/sales-schedule"
              element={
                <Guard roles={sales}>
                  <SalesSchedule />
                </Guard>
              }
            />
            <Route
              path="/users"
              element={
                <Guard roles={["admin"]}>
                  <Users />
                </Guard>
              }
            />
            <Route
              path="/users/new"
              element={
                <Guard roles={["admin"]}>
                  <UserProfile />
                </Guard>
              }
            />
            <Route
              path="/users/:id"
              element={
                <Guard roles={["admin"]}>
                  <UserProfile />
                </Guard>
              }
            />
            <Route path="/customers" element={<Customers />} />
            <Route path="/services" element={<Services />} />
            <Route
              path="/performance"
              element={
                <Guard roles={sales}>
                  <Performance />
                </Guard>
              }
            />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  </Boundary>,
);
