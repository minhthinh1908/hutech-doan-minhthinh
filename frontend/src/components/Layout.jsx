import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "./TopBar.jsx";
import MainHeader from "./MainHeader.jsx";
import CategoryNav from "./CategoryNav.jsx";
import FloatingWarranty from "./FloatingWarranty.jsx";
import ScrollToTopButton from "./ScrollToTopButton.jsx";
import SiteFooter from "./SiteFooter.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function Layout() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <TopBar />
      <MainHeader />
      <CategoryNav />
      <main className="app-main">
        <Outlet />
      </main>
      <SiteFooter />
      <FloatingWarranty />
      <ScrollToTopButton />
    </div>
  );
}
