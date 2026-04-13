import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";

// Components
import Login from "./components/Authorized/login";
import PrivateRoute from "./components/Safety/ProtectedRoute";

// Admin Components
import AdminPanel from "./components/adminComponents/adminpanel";
import AdminPageFirst from "./components/adminComponents/adPage";
import AdminProfile from "./components/adminComponents/adminProfile";
import ArchivePage from "./components/adminComponents/ArchivePage";

// Mentor Components
import MentorsLayout from "./components/mentorsComponent/MentorsLayout";
import MentorsPage from "./components/mentorsComponent/MentorsPage";
import MentorProfilePage from "./components/mentorsComponent/MentorProfile";
import MentorRegister from "./components/RegisterUser/RegisterMentor";
import MentorFinance from "./components/mentorsComponent/MentorFinance";

// Group Components
import GroupsLayout from "./components/GroupsComponent/GroupLayout";
import GroupsListPage from "./components/GroupsComponent/GroupsPage";
import AddGroup from "./components/GroupsComponent/AddGroup";
import GroupDetailLayout from "./components/GroupsComponent/GroupDetailLayout";
import GroupDetailPage from "./components/GroupsComponent/GroupDetails";
import GroupsStudent from "./components/GroupsComponent/GrupsStudent";

// Student Components
import StudentLayout from "./components/StudentComponents/StudentLayout";
import StudentProfilePage from "./components/StudentComponents/Student";
import StudentAdd from "./components/StudentComponents/AddStudent";
import GlobalStudentLayout from "./components/StudentComponents/GlobalStudentLayout";
import GlobalStudentComponent from "./components/StudentComponents/GlobalStudents";
import StudentPayments from "./components/homework/StudentPayments";

// Super Admin Components
import SuperAdminLayout from "./components/SuperAdmin/SuperAdminLayout";
import SuperAdminDashboard from "./components/SuperAdmin/SuperAdminPage";
import AdminList from "./components/SuperAdmin/AdminsList";
import SuperAdminProfile from "./components/SuperAdmin/SuperAdminProfile";
import BranchLayout from "./components/SuperAdmin/branches/BrnchLayout";
import BranchPattern from "./components/SuperAdmin/branches/BranchPattern";
import BranchCreate from "./components/SuperAdmin/branches/AddBranch";
import AdminLayout from "./components/adminComponents/AdminListLayout";
import AdminRegisterView from "./components/RegisterUser/RegisterAdmin";
import MentorProfileLayout from "./components/mentorsComponent/MentorProfLayout";
import HomeworkSubmission from "./components/homework/HomeworkSubmsission";
import MockTestDetails from "./components/mockTests/MockTestDetails";
import AllPaymentsLayout from "./components/SuperAdmin/Finance/AllPaymentsLayout";
import AllPayments from "./components/SuperAdmin/Finance/AllPayments";
import PaymentHistory from "./components/SuperAdmin/Finance/PaymentsStory";
import StaffPayments from "./components/SuperAdmin/Finance/StaffPayments";
import StaffPaymentsLayout from "./components/SuperAdmin/Finance/StaffPaymentsLayout";
import StaffPaymentDetails from "./components/SuperAdmin/Finance/StaffPaymentDetils";
import BranchFinance from "./components/SuperAdmin/Finance/BranchDetails";
import UtilityPayments from "./components/SuperAdmin/Finance/UtilityPayments";

// *** YORDAMCHI WRAPPER KOMPONENT ***
const ProtectedPage = ({ children, allowed }) => {
  return (
    <PrivateRoute allowed={allowed}>
      {children}
    </PrivateRoute>
  );
};

import { ThemeProvider } from "./ThemeContext";

export default function PreApp() {
  const ROLES = {
    ADMIN_ACCESS: ["admin", "super_admin"],
    SUPER_ONLY: ["super_admin"],
    ADMIN_ONLY: ["admin"],
    ALL_ACCESS: ["admin", "mentor", "super_admin"],
  };

  return (
    <ThemeProvider>
      <div className="layout-root">
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/filial" element={<Login />} />

            {/* ================= ADMIN ROUTE SECTION ================= */}
            <Route
              path="/admin"
              element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><AdminPanel /></ProtectedPage>}
            >
              <Route path="" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><AdminPageFirst /></ProtectedPage>} />

              {/* Mentors Section */}
              <Route path="mentors" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MentorsLayout /></ProtectedPage>}>
                <Route index element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MentorsPage /></ProtectedPage>} />
                <Route path=":mentor_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MentorProfilePage /></ProtectedPage>} />
                <Route path="add-mentor" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MentorRegister /></ProtectedPage>} />
              </Route>

              {/* Groups Section */}
              <Route path="groups" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GroupsLayout /></ProtectedPage>}>
                <Route index element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GroupsListPage /></ProtectedPage>} />
                <Route path="addgroup" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><AddGroup /></ProtectedPage>} />

                <Route path=":group_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GroupDetailLayout /></ProtectedPage>}>
                  <Route index element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GroupDetailPage /></ProtectedPage>} />
                  <Route path="add_student" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><StudentAdd /></ProtectedPage>} />

                  <Route path="students" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><StudentLayout /></ProtectedPage>}>
                    <Route index element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GroupsStudent /></ProtectedPage>} />
                    <Route path=":student_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><StudentProfilePage /></ProtectedPage>} />
                  </Route>

                  <Route path="homeworks/:mission_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><HomeworkSubmission /></ProtectedPage>} />
                  <Route path="mock-tests/:test_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MockTestDetails /></ProtectedPage>} />
                </Route>
              </Route>

              {/* Global Students Section (Corrected Access) */}
              <Route path="all_students" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GlobalStudentLayout /></ProtectedPage>}>
                <Route index element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><GlobalStudentComponent /></ProtectedPage>} />
                <Route path=":student_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><StudentProfilePage /></ProtectedPage>} />
                <Route path="add_to_global" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><StudentAdd /></ProtectedPage>} />
              </Route>

              <Route path="finance" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><MentorFinance /></ProtectedPage>} />
              <Route path="profile" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><AdminProfile /></ProtectedPage>} />
              <Route path="archive" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><ArchivePage /></ProtectedPage>} />
            </Route>


            {/* ================= SUPER ADMIN ROUTE SECTION ================= */}
            <Route path="/super_admin" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><SuperAdminLayout /></ProtectedPage>}>

              <Route path="all-payments" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><AllPaymentsLayout /></ProtectedPage>}>
                <Route index element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><AllPayments /></ProtectedPage>} />
                <Route path="payments-history" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><PaymentHistory /></ProtectedPage>} />
                <Route path="staff-payments" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><StaffPaymentsLayout /></ProtectedPage>} >
                  <Route index element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><StaffPayments /></ProtectedPage>} />
                  <Route path="staff/:staff_id" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><StaffPaymentDetails /></ProtectedPage>} />
                </Route>
                <Route path="utility-payments" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><UtilityPayments /></ProtectedPage>} />
                <Route path="branch-details/:b_id" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><BranchFinance /></ProtectedPage>} />
              </Route>

              <Route element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><BranchPattern /></ProtectedPage>}>
                <Route path="profile" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><SuperAdminProfile /></ProtectedPage>} />
                <Route index element={<div className="w-full h-screen flex justify-center items-center m-auto text-[var(--text-secondary)]"><h1 className="-mt-84 text-5xl font-black uppercase opacity-20">Filialni tanlang</h1> </div>} />

                <Route path="add-branch" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><BranchCreate /></ProtectedPage>} />
                <Route path="branch/:branch_id" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><BranchLayout /></ProtectedPage>}>
                  <Route index element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><SuperAdminDashboard /></ProtectedPage>} />
                  <Route path="archive" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><ArchivePage /></ProtectedPage>} />

                  <Route path="admins" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><AdminLayout /></ProtectedPage>}>
                    <Route index element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><AdminList /></ProtectedPage>} />
                    <Route path="admin_add" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><AdminRegisterView /></ProtectedPage>} />
                    <Route path=":admin_id" element={<ProtectedPage allowed={ROLES.ADMIN_ACCESS}><AdminProfile /></ProtectedPage>} />
                  </Route>

                  <Route path="mentors" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><MentorsLayout /></ProtectedPage>}>
                    <Route index element={<MentorsPage />} />
                    <Route path=":mentor_id" element={<MentorProfilePage />} />
                    <Route path="add-mentor" element={<MentorRegister />} />
                  </Route>

                  <Route path="groups" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><GroupsLayout /></ProtectedPage>}>
                    <Route index element={<GroupsListPage />} />
                    <Route path="addgroup" element={<AddGroup />} />
                    <Route path=":group_id" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><GroupDetailLayout /></ProtectedPage>}>
                      <Route index element={<GroupDetailPage />} />
                      <Route path="add_student" element={<StudentAdd />} />
                      <Route path="students" element={<StudentLayout />}>
                        <Route index element={<GroupsStudent />} />
                        <Route path=":student_id" element={<StudentProfilePage />} />
                      </Route>
                      <Route path="homeworks/:mission_id" element={<HomeworkSubmission />} />
                      <Route path="mock-tests/:test_id" element={<MockTestDetails />} />
                    </Route>
                  </Route>

                  <Route path="all_students" element={<ProtectedPage allowed={ROLES.SUPER_ONLY}><GlobalStudentLayout /></ProtectedPage>}>
                    <Route index element={<GlobalStudentComponent />} />
                    <Route path=":student_id" element={<StudentProfilePage />} />
                    <Route path="add_to_global" element={<StudentAdd />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* ========================  MENTOR SHARED ROUTES ====================== */}
            <Route path="/mentor" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><MentorProfileLayout /></ProtectedPage>}>
              <Route index element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><MentorProfilePage viewMode="groups" /></ProtectedPage>} />
              <Route path="profile" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><MentorProfilePage viewMode="profile" /></ProtectedPage>} />
              <Route path="finance" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><MentorFinance /></ProtectedPage>} />
              <Route path="groups/:group_id" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><GroupDetailLayout /></ProtectedPage>}>
                <Route index element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><GroupDetailPage /></ProtectedPage>} />
                <Route path="students/:student_id" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><StudentProfilePage /></ProtectedPage>} />
                <Route path="homeworks/:mission_id" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><HomeworkSubmission /></ProtectedPage>} />
                <Route path="mock-tests/:test_id" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><MockTestDetails /></ProtectedPage>} />
              </Route>
            </Route>

            <Route path="/group" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><GroupDetailPage /></ProtectedPage>} />
            <Route path="/student" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><StudentProfilePage /></ProtectedPage>} />
            <Route path="/studentpayments" element={<ProtectedPage allowed={ROLES.ALL_ACCESS}><StudentPayments /></ProtectedPage>} />

          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}