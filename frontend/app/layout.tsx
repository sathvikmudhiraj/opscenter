import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsCenter",
  description: "Enterprise PC support and ticket management system"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="extension-error-guard" strategy="beforeInteractive">
          {`
            (function () {
              function isExtensionReactRootError(event) {
                var message = String(event && (event.message || event.reason && event.reason.message) || "");
                var filename = String(event && event.filename || "");
                var stack = String(event && event.error && event.error.stack || event && event.reason && event.reason.stack || "");
                var source = filename + " " + stack;
                return source.indexOf("chrome-extension://") !== -1 &&
                  (message.indexOf("Minified React error #299") !== -1 || stack.indexOf("createRoot") !== -1);
              }

              window.addEventListener("error", function (event) {
                if (isExtensionReactRootError(event)) {
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  return true;
                }
              }, true);

              window.addEventListener("unhandledrejection", function (event) {
                if (isExtensionReactRootError(event)) {
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  return true;
                }
              }, true);
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
