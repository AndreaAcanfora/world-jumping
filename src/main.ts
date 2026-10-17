import './style.css';
import { App } from './ui/App';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(
  canvas,
  document.getElementById('screen')!,
  document.getElementById('hud')!,
  document.getElementById('touch')!,
);
app.showMenu();
