import { createApp } from 'vue';
import App from './App.vue';
import RemoteApp from './RemoteApp.vue';
import './assets/styles/style.css';
import { resolveRuntimeEntry } from './services/runtimeEntry';

const runtimeEntry = resolveRuntimeEntry(window.location.pathname);

if (runtimeEntry === 'slave') {
  void import('./slave/main');
} else {
  createApp(runtimeEntry === 'remote' ? RemoteApp : App).mount('#app');
}
