import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

const AppLayout = lazy(() => import('./layouts/AppLayout.jsx'));
const Apply = lazy(() => import('./pages/Apply.jsx'));
const AssignmentResults = lazy(() => import('./pages/AssignmentResults.jsx'));
const Badges = lazy(() => import('./pages/Badges.jsx'));
const Billing = lazy(() => import('./pages/Billing.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Certificates = lazy(() => import('./pages/Certificates.jsx'));
const CompanySettings = lazy(() => import('./pages/CompanySettings.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Departments = lazy(() => import('./pages/Departments.jsx'));
const DriveDetail = lazy(() => import('./pages/DriveDetail.jsx'));
const Drives = lazy(() => import('./pages/Drives.jsx'));
const Employees = lazy(() => import('./pages/Employees.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Learning = lazy(() => import('./pages/Learning.jsx'));
const LogIn = lazy(() => import('./pages/LogIn.jsx'));
const MasterPanel = lazy(() => import('./pages/MasterPanel.jsx'));
const MyTests = lazy(() => import('./pages/MyTests.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Paths = lazy(() => import('./pages/Paths.jsx'));
const Player = lazy(() => import('./pages/Player.jsx'));
const Practice = lazy(() => import('./pages/Practice.jsx'));
const QuestionForm = lazy(() => import('./pages/QuestionForm.jsx'));
const Questions = lazy(() => import('./pages/Questions.jsx'));
const RecycleBin = lazy(() => import('./pages/RecycleBin.jsx'));
const RegisterCompany = lazy(() => import('./pages/RegisterCompany.jsx'));
const ReportingSettings = lazy(() => import('./pages/ReportingSettings.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Review = lazy(() => import('./pages/Review.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const RolesPermissions = lazy(() => import('./pages/RolesPermissions.jsx'));
const Schedules = lazy(() => import('./pages/Schedules.jsx'));
const SelectCompany = lazy(() => import('./pages/SelectCompany.jsx'));
const SimpleOrgPage = lazy(() => import('./pages/SimpleOrgPage.jsx'));
const StudyLibrary = lazy(() => import('./pages/StudyLibrary.jsx'));
const StudyMaterialForm = lazy(() => import('./pages/StudyMaterialForm.jsx'));
const StudyMaterialView = lazy(() => import('./pages/StudyMaterialView.jsx'));
const TestAssignments = lazy(() => import('./pages/TestAssignments.jsx'));
const TestDetails = lazy(() => import('./pages/TestDetails.jsx'));
const TestForm = lazy(() => import('./pages/TestForm.jsx'));
const TestResults = lazy(() => import('./pages/TestResults.jsx'));
const Tests = lazy(() => import('./pages/Tests.jsx'));

function Protected({ children, roles, perm }) {
  const { isAuthenticated, loading, role, can } = useAuth();
  if (loading) {
    return (
      <div className="auth-page">
        <p className="loading-text">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/log-in" replace />;
  // The master admin lives in the platform panel, not the tenant app —
  // except while impersonating a user.
  if (role === 'master_admin' && !roles?.includes('master_admin')) {
    return <Navigate to="/master" replace />;
  }
  // Allowed if a built-in role matches OR the user holds the route's permission
  // (custom-role users are gated by permission, not by fixed role).
  const roleOk = !roles || roles.includes(role);
  const permOk = perm && can(perm);
  if (roles && !roleOk && !permOk) return <Navigate to="/app" replace />;
  return children;
}

const MANAGERS = ['company_admin', 'hr', 'team_leader'];

function HomeDashboard() {
  return <Dashboard />;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <p className="loading-text">Loading…</p>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/log-in" replace />} />
        <Route path="/log-in" element={<LogIn />} />
        <Route path="/register" element={<RegisterCompany />} />
        <Route path="/select-company" element={<SelectCompany />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Public candidate portal — no login, reached via the drive link. */}
        <Route path="/apply/:token" element={<Apply />} />
        {/* Platform operator panel. */}
        <Route
          path="/master"
          element={
            <Protected roles={['master_admin']}>
              <MasterPanel />
            </Protected>
          }
        />
        <Route
          path="/app"
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route index element={<HomeDashboard />} />
          <Route
            path="departments"
            element={
              <Protected roles={MANAGERS} perm="departments:read">
                <Departments />
              </Protected>
            }
          />
          <Route
            path="branches"
            element={
              <Protected roles={MANAGERS} perm="branches:read">
                <SimpleOrgPage
                  endpoint="/branches"
                  singular="Branch"
                  plural="Branches"
                  subtitle="Your company's office locations."
                />
              </Protected>
            }
          />
          <Route
            path="teams"
            element={
              <Protected roles={MANAGERS} perm="teams:read">
                <SimpleOrgPage
                  endpoint="/teams"
                  singular="Team"
                  plural="Teams"
                  subtitle="Teams within your departments."
                />
              </Protected>
            }
          />
          <Route
            path="employees"
            element={
              <Protected roles={MANAGERS} perm="employees:read">
                <Employees />
              </Protected>
            }
          />
          <Route
            path="roles"
            element={
              <Protected roles={['company_admin']} perm="roles:manage">
                <RolesPermissions />
              </Protected>
            }
          />
          <Route
            path="questions"
            element={
              <Protected roles={MANAGERS}>
                <Questions />
              </Protected>
            }
          />
          <Route
            path="categories"
            element={
              <Protected roles={['company_admin']}>
                <Categories />
              </Protected>
            }
          />
          <Route
            path="questions/:id"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <QuestionForm />
              </Protected>
            }
          />
          <Route
            path="tests"
            element={
              <Protected roles={MANAGERS}>
                <Tests />
              </Protected>
            }
          />
          <Route
            path="tests/:id"
            element={
              <Protected roles={MANAGERS}>
                <TestForm />
              </Protected>
            }
          />
          <Route
            path="tests/:id/details"
            element={
              <Protected roles={MANAGERS}>
                <TestDetails />
              </Protected>
            }
          />
          <Route
            path="tests/:id/results"
            element={
              <Protected roles={MANAGERS}>
                <TestResults />
              </Protected>
            }
          />
          <Route
            path="tests/:id/assignments"
            element={
              <Protected roles={MANAGERS}>
                <TestAssignments />
              </Protected>
            }
          />
          <Route
            path="tests/:id/assignments/:assignmentId/results"
            element={
              <Protected roles={MANAGERS}>
                <AssignmentResults />
              </Protected>
            }
          />
          <Route
            path="schedules"
            element={
              <Protected roles={MANAGERS}>
                <Schedules />
              </Protected>
            }
          />
          <Route path="my-tests" element={<MyTests />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="attempt/:id" element={<Player />} />
          <Route path="results/:id" element={<Review />} />
          <Route path="practice" element={<Practice />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route
            path="reports"
            element={
              <Protected roles={MANAGERS} perm="reports:read">
                <Reports />
              </Protected>
            }
          />
          <Route
            path="reporting-settings"
            element={
              <Protected roles={['company_admin']}>
                <ReportingSettings />
              </Protected>
            }
          />
          <Route path="learning" element={<Learning />} />
          <Route path="study" element={<StudyLibrary />} />
          <Route
            path="study/new"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <StudyMaterialForm />
              </Protected>
            }
          />
          <Route path="study/:id" element={<StudyMaterialView />} />
          <Route path="badges" element={<Badges />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="calendar" element={<Calendar />} />
          <Route
            path="billing"
            element={
              <Protected roles={['company_admin']}>
                <Billing />
              </Protected>
            }
          />
          <Route
            path="recycle-bin"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <RecycleBin />
              </Protected>
            }
          />
          <Route
            path="company-settings"
            element={
              <Protected roles={['company_admin']}>
                <CompanySettings />
              </Protected>
            }
          />
          <Route
            path="paths"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <Paths />
              </Protected>
            }
          />
          <Route
            path="reviews"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <Reviews />
              </Protected>
            }
          />
          <Route
            path="drives"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <Drives />
              </Protected>
            }
          />
          <Route
            path="drives/:id"
            element={
              <Protected roles={['company_admin', 'hr']}>
                <DriveDetail />
              </Protected>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/log-in" replace />} />
      </Routes>
    </Suspense>
  );
}
