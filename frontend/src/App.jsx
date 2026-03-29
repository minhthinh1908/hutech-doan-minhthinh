import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AdminShell from "./components/AdminShell.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import HomePage from "./pages/HomePage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import StaticPage from "./pages/StaticPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ProductBrowsePage from "./pages/ProductBrowsePage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import CartPage from "./pages/CartPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import WarrantiesPage from "./pages/WarrantiesPage.jsx";
import RepairsPage from "./pages/RepairsPage.jsx";
import RefundsPage from "./pages/RefundsPage.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminProducts from "./pages/admin/AdminProducts.jsx";
import AdminCategories from "./pages/admin/AdminCategories.jsx";
import AdminBrands from "./pages/admin/AdminBrands.jsx";
import AdminVouchers from "./pages/admin/AdminVouchers.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminWarranties from "./pages/admin/AdminWarranties.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminRepairs from "./pages/admin/AdminRepairs.jsx";
import AdminRefunds from "./pages/admin/AdminRefunds.jsx";
import AdminFooterSettings from "./pages/admin/AdminFooterSettings.jsx";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lien-he" element={<ContactPage />} />
        <Route path="gioi-thieu" element={<StaticPage title="Giới thiệu" />} />
        <Route path="dich-vu" element={<StaticPage title="Dịch vụ" />} />
        <Route path="tin-tuc" element={<StaticPage title="Tin tức" />} />
        <Route path="dang-nhap" element={<LoginPage />} />
        <Route path="dang-ky" element={<RegisterPage />} />
        <Route path="san-pham" element={<ProductBrowsePage />} />
        <Route path="san-pham/:id" element={<ProductDetailPage />} />
        <Route
          path="tai-khoan"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="gio-hang"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="don-hang"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="don-hang/:id"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="bao-hanh"
          element={
            <RequireAuth>
              <WarrantiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="sua-chua"
          element={
            <RequireAuth>
              <RepairsPage />
            </RequireAuth>
          }
        />
        <Route
          path="hoan-tien"
          element={
            <RequireAuth>
              <RefundsPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminShell />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="san-pham" element={<AdminProducts />} />
        <Route path="danh-muc" element={<AdminCategories />} />
        <Route path="thuong-hieu" element={<AdminBrands />} />
        <Route path="voucher" element={<AdminVouchers />} />
        <Route path="don-hang" element={<AdminOrders />} />
        <Route path="khach-hang" element={<AdminUsers />} />
        <Route path="bao-hanh" element={<AdminWarranties />} />
        <Route path="bao-cao" element={<AdminReports />} />
        <Route path="sua-chua" element={<AdminRepairs />} />
        <Route path="hoan-tien" element={<AdminRefunds />} />
        <Route path="chan-trang" element={<AdminFooterSettings />} />
      </Route>
    </Routes>
  );
}
