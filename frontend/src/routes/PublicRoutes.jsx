import { Route } from "react-router-dom";
import Login from "../components/Authorized/login";
import GroupDetailPage from "../components/GroupsComponent/GroupDetails";
import StudentProfilePage from "../components/StudentComponents/Student";
import StudentPayments from "../components/homework/StudentPayments";

export const PublicRoutes = (
  <>
    <Route path="/" element={<Login />} />
    <Route path="/login" element={<Login />} />
    <Route path="/filial" element={<Login />} />
    
    {/* Shared/Stand-alone routes that require ALL_ACCESS usually */}
    <Route path="/group" element={<GroupDetailPage />} />
    <Route path="/student" element={<StudentProfilePage />} />
    <Route path="/studentpayments" element={<StudentPayments />} />
  </>
);
