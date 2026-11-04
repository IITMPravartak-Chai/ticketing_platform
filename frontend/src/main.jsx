// Entry point: loads the styles and mounts the app into index.html's #root.
import {createRoot} from 'react-dom/client';
import './styles.css';
import {App} from './App';

createRoot(document.getElementById('root')).render(<App/>);
