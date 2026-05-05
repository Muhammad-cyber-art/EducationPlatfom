import { useState, useEffect } from"react";
import { useOutletContext } from"react-router-dom";
import { User, Users, Layers } from"lucide-react";
import { useCurrentBranch } from"../Authorized/useBranchId";
import { get_user_info } from"../Authorized/getRole";

// Hooks
import { useArchive } from"./Archive/useArchive";

// Components
import ArchiveHeader from"./Archive/ArchiveHeader";
import ArchiveTabs from"./Archive/ArchiveTabs";
import ArchiveTable from"./Archive/ArchiveTable";

export default function ArchivePage() {
 const [activeTab, setActiveTab] = useState("students");
 const user_info = get_user_info();
 const { currentBranchId } = useCurrentBranch();
 const outletContext = useOutletContext() || {};
 const { branchId: superAdminBranchId } = outletContext;

 const activeBranchId = user_info?.role ==="super_admin"
 ? superAdminBranchId
 : currentBranchId;

 const [searchTerm, setSearchTerm] = useState("");
 const [debouncedSearch, setDebouncedSearch] = useState("");

 useEffect(() => {
 const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
 return () => clearTimeout(timer);
 }, [searchTerm]);

 const {
 studentsQuery,
 staffQuery,
 groupsQuery,
 restoreMutation,
 deleteMutation
 } = useArchive(debouncedSearch, activeBranchId);

 const onRestore = (id) => restoreMutation.mutate({ type: activeTab, id });
 const onDelete = (id) => {
 if (window.confirm("DIQQAT: Ushbu yozuvni butunlay o'chirib tashlaysizmi?")) {
 deleteMutation.mutate({ type: activeTab, id });
 }
 };

 const tabs = [
 { id:"students", label:"O'quvchilar", icon: User, count: studentsQuery.data?.length || 0 },
 { id:"staff", label:"Xodimlar", icon: Users, count: staffQuery.data?.length || 0 },
 { id:"groups", label:"Guruhlar", icon: Layers, count: groupsQuery.data?.length || 0 },
 ];

 const currentQuery = activeTab ==="students" ? studentsQuery : activeTab ==="staff" ? staffQuery : groupsQuery;

 return (
 <div className="animate-lux-fade space-y-10 pb-20">
 {/* Atmosphere Background */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient opacity-[0.03]"></div>
 <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
 </div>

 <ArchiveHeader searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

 <ArchiveTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

 <ArchiveTable 
 type={activeTab}
 data={currentQuery.data || []}
 isLoading={currentQuery.isLoading}
 onRestore={onRestore}
 onDelete={onDelete}
 hasNextPage={currentQuery.hasNextPage}
 isFetchingNextPage={currentQuery.isFetchingNextPage}
 fetchNextPage={currentQuery.fetchNextPage}
 />
 </div>
 );
}
