import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AppGate from '@/components/AppGate';
import { RoleProvider } from '@/lib/rbac';
import { AdminAuthProvider } from '@/lib/adminAuth';
import { ThemeProvider } from '@/lib/theme';
import { NotificationProvider } from '@/lib/notifications';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppGate>
      <ThemeProvider>
        <RoleProvider>
          <AdminAuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AdminAuthProvider>
        </RoleProvider>
      </ThemeProvider>
    </AppGate>
  </StrictMode>
);
