import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider, useApp } from "./context";
import { Shell, roleHome } from "./components/Shell";
import { QuoteEditor, QuoteDetail, Quotes } from "./pages/Quotes";
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
import {
  Contractors,
  ProductStyles,
  Suppliers,
} from "./pages/Placeholders";
import { Documents } from "./pages/Documents";
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
          <Route path="/documents/:kind/:id" element={<Documents />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/quotes"
              element={
                <Guard roles={[...sales, "admin", "finance"]}>
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
                <Guard roles={sales}>
                  <QuoteEditor />
                </Guard>
              }
            />
            <Route
              path="/quotes/:id"
              element={
                <Guard roles={[...sales, "admin", "finance"]}>
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
              path="/submissions"
              element={
                <Guard roles={["clerk", "admin"]}>
                  <Submissions />
                </Guard>
              }
            />
            <Route
              path="/invoices"
              element={
                <Guard roles={["clerk", "finance", "admin"]}>
                  <Invoices />
                </Guard>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <Guard roles={["clerk", "finance", "admin"]}>
                  <InvoiceDetail />
                </Guard>
              }
            />
            <Route
              path="/handoff"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin"]}>
                  <Handoff />
                </Guard>
              }
            />
            <Route
              path="/orders"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "finance"]}>
                  <Orders />
                </Guard>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin", "finance"]}>
                  <OrderDetail />
                </Guard>
              }
            />
            <Route
              path="/contractors"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin"]}>
                  <Contractors />
                </Guard>
              }
            />
            <Route
              path="/suppliers"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin"]}>
                  <Suppliers />
                </Guard>
              }
            />
            <Route
              path="/product-styles"
              element={
                <Guard roles={["cs", "cs_supervisor", "admin"]}>
                  <ProductStyles />
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
