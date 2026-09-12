import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { QueueProvider } from './context/QueueContext';
import { ToastContainer } from './components/common/ToastContainer';
import { DemoSwitcher } from './components/common/DemoSwitcher';
import { PatientRoute, AdminRoute } from './components/common/ProtectedRoute';

// Public
import { LandingPage } from './pages/LandingPage';

// Patient Pages
import { PatientLogin } from './pages/patient/PatientLogin';
import { PatientRegister } from './pages/patient/PatientRegister';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorList } from './pages/patient/DoctorList';
import { DoctorDetails } from './pages/patient/DoctorDetails';
import { BookAppointment } from './pages/patient/BookAppointment';
import { TokenScreen } from './pages/patient/TokenScreen';
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientProfile } from './pages/patient/PatientProfile';

// Admin Pages
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminQueue } from './pages/admin/AdminQueue';
import { AdminAppointments } from './pages/admin/AdminAppointments';
import { AdminDoctors } from './pages/admin/AdminDoctors';
import { AddDoctor } from './pages/admin/AddDoctor';
import { AdminPatients } from './pages/admin/AdminPatients';
import { AdminClinics } from './pages/admin/AdminClinics';
import { AdminSettings } from './pages/admin/AdminSettings';

export function App() {
  return (
    <Router>
      <AuthProvider>
        <QueueProvider>
          {/* Subtle switcher for easy reviewer testing between Patient & Admin */}
          <DemoSwitcher />

          {/* Core Routes */}
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Public Auth Routes */}
            <Route path="/patient/login" element={<PatientLogin />} />
            <Route path="/patient/register" element={<PatientRegister />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Protected Patient Routes */}
            <Route
              path="/patient/dashboard"
              element={
                <PatientRoute>
                  <PatientDashboard />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/doctors"
              element={
                <PatientRoute>
                  <DoctorList />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/doctors/:id"
              element={
                <PatientRoute>
                  <DoctorDetails />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/book"
              element={
                <PatientRoute>
                  <BookAppointment />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/token"
              element={
                <PatientRoute>
                  <TokenScreen />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/appointments"
              element={
                <PatientRoute>
                  <PatientAppointments />
                </PatientRoute>
              }
            />
            <Route
              path="/patient/profile"
              element={
                <PatientRoute>
                  <PatientProfile />
                </PatientRoute>
              }
            />

            {/* Protected Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/queue"
              element={
                <AdminRoute>
                  <AdminQueue />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/appointments"
              element={
                <AdminRoute>
                  <AdminAppointments />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/doctors"
              element={
                <AdminRoute>
                  <AdminDoctors />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/doctors/add"
              element={
                <AdminRoute>
                  <AddDoctor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/patients"
              element={
                <AdminRoute>
                  <AdminPatients />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/clinics"
              element={
                <AdminRoute>
                  <AdminClinics />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <AdminSettings />
                </AdminRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Feedback Toasts */}
          <ToastContainer />
        </QueueProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
