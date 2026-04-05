import { createApp } from 'vue';
import App from './App.vue';
import RemoteApp from './RemoteApp.vue';
import './assets/styles/style.css';

const isRemoteRoute = window.location.pathname === '/remote';

createApp(isRemoteRoute ? RemoteApp : App).mount('#app');
