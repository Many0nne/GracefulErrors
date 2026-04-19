import { createApp } from "vue";
import { createErrorEnginePlugin } from "gracefulerrors/vue";
import { SonnerToaster } from "gracefulerrors/sonner";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { engine } from "./engine";
import App from "./App.vue";

// The Sonner adapter calls `toast` from the `sonner` package, which requires
// the React <Toaster> to be mounted — vue-sonner's <Toaster> has its own
// separate internal state and won't pick up those calls.
const toasterContainer = document.createElement("div");
document.body.appendChild(toasterContainer);
createRoot(toasterContainer).render(
  createElement(SonnerToaster, { richColors: true, position: "top-right" }),
);

createApp(App)
  // Install the plugin — provides the engine to every component via inject/useErrorEngine
  .use(createErrorEnginePlugin(engine))
  .mount("#app");
