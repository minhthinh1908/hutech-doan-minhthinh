import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-amber/theme.css";
import "primeicons/primeicons.css";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CoreToastProvider } from "./components/ui/index.js";
import App from "./App.jsx";
import "./index.css";
import "./styles/coreUnified.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrimeReactProvider>
      <BrowserRouter>
        <CoreToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </CoreToastProvider>
      </BrowserRouter>
    </PrimeReactProvider>
  </React.StrictMode>
);
