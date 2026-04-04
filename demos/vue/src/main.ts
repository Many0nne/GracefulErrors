import { createApp } from 'vue'
import { createErrorEnginePlugin } from 'gracefulerrors/vue'
import App from './App.vue'
import { engine } from './engine'

const app = createApp(App)
app.use(createErrorEnginePlugin(engine))
app.mount('#app')
